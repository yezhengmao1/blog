# Table查询磁盘数据

## 简介

前文已经描述如何通过 `TableBuilder` 将 `MemTable` 持久化到磁盘中，本文描述其逆操作，即如何从磁盘文件读取数据到内存中，并提供迭代器进行访问。

具体写入流程以及文件格式参考[TableBuilder 持久化 MemTable 数据](06-TableBuilder.md)。

读入流程总体顺序如下：

* 随机访问文件获取`footer`内容，从`footer`中获取元数据分块和索引数据分块的偏移。
* 读取索引数据块，读取元数据块，并从元数据块所记录的过滤器数据块中读取内容。
* 使用`Table`的迭代器访问其中`data`数据内容（`data`数据块按需读入内存）。

## 实现

`Table`创建时读取文件中的过滤器数据块、索引数据块，根据索引数据块建立两级索引，第一级使用索引数据查询，第二级按需读取数据块内容并生成访问迭代器查询。

### Table

```cpp showLineNumbers
// open时需要读取index block, meta block 内容
// 再根据 meta block 内容读取 filter block 内容
// data block 内容不读取
Status Table::Open(const Options& options, RandomAccessFile* file,
                   uint64_t size, Table** table) {
  *table = nullptr;
  if (size < Footer::kEncodedLength) {
    return Status::Corruption("file is too short to be an sstable");
  }
  // 读取footer定长内容，解析为Footer类
  char footer_space[Footer::kEncodedLength];
  Slice footer_input;
  Status s = file->Read(size - Footer::kEncodedLength, Footer::kEncodedLength,
                        &footer_input, footer_space);
  if (!s.ok()) return s;
  Footer footer;
  s = footer.DecodeFrom(&footer_input);
  if (!s.ok()) return s;
  // 读取索引块内容
  BlockContents index_block_contents;
  ReadOptions opt;
  if (options.paranoid_checks) {
    opt.verify_checksums = true;
  }
  s = ReadBlock(file, opt, footer.index_handle(), &index_block_contents);
  // 读取元数据块
  if (s.ok()) {
    Block* index_block = new Block(index_block_contents);
    Rep* rep = new Table::Rep;
    rep->options = options;
    rep->file = file;
    rep->metaindex_handle = footer.metaindex_handle();
    rep->index_block = index_block;
    rep->cache_id = (options.block_cache ? options.block_cache->NewId() : 0);
    rep->filter_data = nullptr;
    rep->filter = nullptr;
    *table = new Table(rep);
    (*table)->ReadMeta(footer);
  }
  return s;
}

// 读取元数据块流程
void Table::ReadMeta(const Footer& footer) {
  // 是否支持使用过滤器
  if (rep_->options.filter_policy == nullptr) {
    return;
  }
  ReadOptions opt;
  if (rep_->options.paranoid_checks) {
    opt.verify_checksums = true;
  }
  BlockContents contents;
  // 读取元数据块内容
  if (!ReadBlock(rep_->file, opt, footer.metaindex_handle(), &contents).ok()) {
    return;
  }
  Block* meta = new Block(contents);
  // 元数据块中存放filter块元数据信息
  Iterator* iter = meta->NewIterator(BytewiseComparator());
  std::string key = "filter.";
  key.append(rep_->options.filter_policy->Name());
  iter->Seek(key);
  if (iter->Valid() && iter->key() == Slice(key)) {
    // 根据filter元数据读取过滤器数据
    ReadFilter(iter->value());
  }
  delete iter;
  delete meta;
}

// 传入元数据信息读取filter数据
void Table::ReadFilter(const Slice& filter_handle_value) {
  Slice v = filter_handle_value;
  BlockHandle filter_handle;
  if (!filter_handle.DecodeFrom(&v).ok()) {
    return;
  }
  ReadOptions opt;
  if (rep_->options.paranoid_checks) {
    opt.verify_checksums = true;
  }
  // 读取filter数据块
  BlockContents block;
  if (!ReadBlock(rep_->file, opt, filter_handle, &block).ok()) {
    return;
  }
  if (block.heap_allocated) {
    rep_->filter_data = block.data.data(); 
  }
  // 创建 filterblockreader
  rep_->filter = new FilterBlockReader(rep_->options.filter_policy, block.data);
}

// 返回迭代器
// 创建一个两级迭代器
// 第一级为索引块的迭代器
// 内部实现见下文
Iterator* Table::NewIterator(const ReadOptions& options) const {
  return NewTwoLevelIterator(
      rep_->index_block->NewIterator(rep_->options.comparator),
      &Table::BlockReader, const_cast<Table*>(this), options);
}

// 迭代器访问过程读取 block 使用的函数
Iterator* Table::BlockReader(void* arg, const ReadOptions& options,
                             const Slice& index_value) {
  Table* table = reinterpret_cast<Table*>(arg);
  Cache* block_cache = table->rep_->options.block_cache;
  Block* block = nullptr;
  Cache::Handle* cache_handle = nullptr;
  // 获取 block 块的索引数据 
  BlockHandle handle;
  Slice input = index_value;
  Status s = handle.DecodeFrom(&input);
  // 读取 block 块内容
  // 使用 LRUCache 来存放数据内容进行优化
  if (s.ok()) {
    BlockContents contents;
    if (block_cache != nullptr) {
      char cache_key_buffer[16];
      EncodeFixed64(cache_key_buffer, table->rep_->cache_id);
      EncodeFixed64(cache_key_buffer + 8, handle.offset());
      Slice key(cache_key_buffer, sizeof(cache_key_buffer));
      cache_handle = block_cache->Lookup(key);
      if (cache_handle != nullptr) {
        block = reinterpret_cast<Block*>(block_cache->Value(cache_handle));
      } else {
        s = ReadBlock(table->rep_->file, options, handle, &contents);
        if (s.ok()) {
          block = new Block(contents);
          if (contents.cachable && options.fill_cache) {
            cache_handle = block_cache->Insert(key, block, block->size(),
                                               &DeleteCachedBlock);
          }
        }
      }
    } else {
      s = ReadBlock(table->rep_->file, options, handle, &contents);
      if (s.ok()) {
        block = new Block(contents);
      }
    }
  }
  // 返回 block 块的迭代器
  Iterator* iter;
  if (block != nullptr) {
    iter = block->NewIterator(table->rep_->options.comparator);
    if (cache_handle == nullptr) {
      iter->RegisterCleanup(&DeleteBlock, block, nullptr);
    } else {
      iter->RegisterCleanup(&ReleaseBlock, block_cache, cache_handle);
    }
  } else {
    iter = NewErrorIterator(s);
  }
  return iter;
}

```

### FilterBlockReader

```cpp showLineNumbers
FilterBlockReader::FilterBlockReader(const FilterPolicy* policy,
                                     const Slice& contents)
    : policy_(policy), data_(nullptr), offset_(nullptr), num_(0), base_lg_(0) {
  // 按照格式读取 filterblock 数据
  size_t n = contents.size();
  if (n < 5) return;
  base_lg_ = contents[n - 1];
  uint32_t last_word = DecodeFixed32(contents.data() + n - 5);
  if (last_word > n - 5) return;
  data_ = contents.data();
  offset_ = data_ + last_word;
  // 计算有多少个 filter 数据块
  num_ = (n - 5 - last_word) / 4;
}

bool FilterBlockReader::KeyMayMatch(uint64_t block_offset, const Slice& key) {
  // 通过 block_offset 判断 key 是否存在
  uint64_t index = block_offset >> base_lg_;
  if (index < num_) {
    // 找到对应的 filter 数据块
    uint32_t start = DecodeFixed32(offset_ + index * 4);
    uint32_t limit = DecodeFixed32(offset_ + index * 4 + 4);
    if (start <= limit && limit <= static_cast<size_t>(offset_ - data_)) {
      // 使用过滤器查看是否匹配
      Slice filter = Slice(data_ + start, limit - start);
      return policy_->KeyMayMatch(key, filter);
    } else if (start == limit) {
      return false;
    }
  }
  return true; 
}
```

### TwoLevelIterator

```cpp showLineNumbers
// 读取 data 块数据
void TwoLevelIterator::InitDataBlock() {
  if (!index_iter_.Valid()) {
    SetDataIterator(nullptr);
  } else {
    Slice handle = index_iter_.value();
    if (data_iter_.iter() != nullptr &&
        handle.compare(data_block_handle_) == 0) {
    } else {
      // 读取 block 数据并设置数据块迭代器
      // 这里的读取函数为 table 中的 readblock 函数
      Iterator* iter = (*block_function_)(arg_, options_, handle);
      data_block_handle_.assign(handle.data(), handle.size());
      SetDataIterator(iter);
    }
  }
}
// 查找
// 1. 通过索引块查找
// 2. 读取索引块对应 data 块内容
// 3. 通过 data 块索引查找
void TwoLevelIterator::Seek(const Slice& target) {
  index_iter_.Seek(target);
  InitDataBlock();
  if (data_iter_.iter() != nullptr) data_iter_.Seek(target);
  SkipEmptyDataBlocksForward();
}
```

