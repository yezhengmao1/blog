# MemTable键值对缓存表
## 简介

`Memtable` 仅仅只是对 `SkipList` 和比较器的简单包装，将要插入的 `Key / Value` 两种类型数据最合并处理并插入到 `SkipList` 中。

对于合并后的 `KV` 数据，`Memtable` 需要提供比较器给 `SkipList` 进行比较，同时由于 `SkipList` 不接受插入相同 `Key` 的数据， `Memtable` 还需要进一步处理来区别相同的 `Key` 值大小比较。

`Memtable` 对于 `KV` 数据处理如下图所示：

<div style={{ textAlign: 'center' }}>
  <img src="https://yezhem.oss-cn-chengdu.aliyuncs.com/blog_img/leveldb-MemTable-0.png" alt="leveldb-MemTable-0" style={{ width: '50%' }}/>
</div>

## 实现

### 构造函数

```cpp showLineNumbers
class MemTable {
public:
    // 采用引用计数的方式来控制析构
    // 注意，构造后需要手动调用 Ref 函数
    explicit MemTable(const InternalKeyComparator &comparator);
    void Ref() {
        ++refs_;
    }

    void Unref() {
        --refs_;
        assert(refs_ >= 0);
        if (refs_ <= 0) {
            delete this;
        }
    }
private:
    typedef SkipList<const char *, KeyComparator> Table;
    ~MemTable(); // 析构函数只能由 Unref 触发了
    // 由于存放 KV 时，memtable会加入其他字段
    // 创建一个内部比较器去包装外部的比较器
    // 通过内部比较器去除包装数据，然后调用外部比较器进行比较
    // 以次来屏蔽 memtable 对数据的包装
    // 具体见插入接口和简介中图
    struct KeyComparator {
        const InternalKeyComparator comparator;
        explicit KeyComparator(const InternalKeyComparator &c) : comparator(c) {
        }
        int operator()(const char *a, const char *b) const;
    };
    KeyComparator comparator_; // 比较器
    int refs_;    // 引用计数器
    Arena arena_; // 构造时，默认构造出的内存分配器，伴随析构将内存清理
    Table table_; // 跳表
};
// 构造时，初始值
MemTable::MemTable(const InternalKeyComparator &comparator)
    // 跳表使用内部 KeyComparator 作为比较器
    // 内部 KeyComparator 构造时，传入用户自定义 comparator 比较器
    : comparator_(comparator), refs_(0), table_(comparator_, &arena_) {
}

// 见简介中图格式
// 内部 KeyComparator 比较器根据internal_key_size将internal_key提取出
// 交由外部传入的 comparator 进行internal_key的比较
// 而 internal_key 的数据又是 key | (SequenceNumber | type) 构成
// 由此可见外部比较器需要处理这多余的 8 字节
int MemTable::KeyComparator::operator()(const char *aptr, const char *bptr) const {
    Slice a = GetLengthPrefixedSlice(aptr);
    Slice b = GetLengthPrefixedSlice(bptr);
    return comparator.Compare(a, b);
}
```

### 插入

```cpp showLineNumbers
// memtable 对于 kev 和 value 的数据封装见简介中图
void MemTable::Add(SequenceNumber s, ValueType type, const Slice &key,
                   const Slice &value) {
    size_t key_size = key.size();
    size_t val_size = value.size();
    // 处理后key的大小为：key的大小 + 8 字节（序列号和type合并）
    size_t internal_key_size = key_size + 8;
    // 总内存如下：
    // internal_key数据的长度，采用 Varint 压缩为变长
    // internal_key数据
    // value数据的长度，采用 Varint 压缩为变长
    // value数据
    const size_t encoded_len = VarintLength(internal_key_size) + 
        					   internal_key_size +
                               VarintLength(val_size) + 
        					   val_size;
    // 分配
    char *buf = arena_.Allocate(encoded_len);
    // key_size 
    char *p = EncodeVarint32(buf, internal_key_size);
    // key_data
    std::memcpy(p, key.data(), key_size);
    p += key_size;
    // 序列号 | type 数据
    EncodeFixed64(p, (s << 8) | type);
    p += 8;
    // value_size
    p = EncodeVarint32(p, val_size);
    // value_data
    std::memcpy(p, value.data(), val_size);
    assert(p + val_size == buf + encoded_len);
    // 
    table_.Insert(buf);
}
```

## 迭代器

```cpp showLineNumbers
// MemTable的迭代器是对 SkipList 迭代器的封装
class MemTableIterator : public Iterator {
public:
    explicit MemTableIterator(MemTable::Table *table) : iter_(table) {
    }

    MemTableIterator(const MemTableIterator &) = delete;
    MemTableIterator &operator=(const MemTableIterator &) = delete;

    ~MemTableIterator() override = default;
	// 判断是否为 nullptr
    bool Valid() const override {
        return iter_.Valid();
    }
    // 查找节点时，需要 key 值转化为 memtable 能够识别的值，比较器才能提取正确数据
    // EncodeKey简单将 key 数据前面加上 key_size
    void Seek(const Slice &k) override {
        iter_.Seek(EncodeKey(&tmp_, k));
    }
    // 下面都是对 skiplist 封装
    void SeekToFirst() override {
        iter_.SeekToFirst();
    }
    void SeekToLast() override {
        iter_.SeekToLast();
    }
    void Next() override {
        iter_.Next();
    }
    void Prev() override {
        iter_.Prev();
    }
    // 获取到的数据，还需要把 key_size 去掉才是 key 数据
    Slice key() const override {
        return GetLengthPrefixedSlice(iter_.key());
    }
    // 将获取到数据的 internal_key 部分去掉就是 value 的数据
    Slice value() const override {
        Slice key_slice = GetLengthPrefixedSlice(iter_.key());
        return GetLengthPrefixedSlice(key_slice.data() + key_slice.size());
    }

    Status status() const override {
        return Status::OK();
    }

private:
    // 跳表的迭代器
    MemTable::Table::Iterator iter_;
    // 临时空间
    std::string tmp_;
};
```

### 查找

```cpp showLineNumbers
bool MemTable::Get(const LookupKey &key, std::string *value, Status *s) {
    Slice memkey = key.memtable_key();
    Table::Iterator iter(&table_);
    iter.Seek(memkey.data());
    // 直接使用迭代器功能查找 key 是否存在，注意 Seek 是查找大于等于语义
    // nullptr是最大的
    // 内部的 internal_key 是 key + seq + type 的数据
    // key 相同的情况，按照 seq 来排序，最新数据 seq 最大
    // 例如
    // 插入 key = 1,val=1,seq = 1,type = v
    // 插入 key = 1,val=2,seq = 2,type = v
    // 查找 key = 1 返回 val = 2,type = v
    // 删除 key = 1,seq = 3,type = d
    // 查找 key = 1 得到 type = d 返回没有 key 
    if (iter.Valid()) {
        const char *entry = iter.key();
        uint32_t key_length;
        const char *key_ptr = GetVarint32Ptr(entry, entry + 5, &key_length);
        // 从 internal_key 中取出 key 来做比较
        // Seek是大于等于语义
        if (comparator_.comparator.user_comparator()->Compare(
                Slice(key_ptr, key_length - 8), key.user_key()) == 0) {
            const uint64_t tag = DecodeFixed64(key_ptr + key_length - 8);
            // 1字节为 type,其余7字节为seq
            switch (static_cast<ValueType>(tag & 0xff)) {
            case kTypeValue: {
                // 跳过internal_key部分就是value
                Slice v = GetLengthPrefixedSlice(key_ptr + key_length);
                value->assign(v.data(), v.size());
                return true;
            }
            // 如果 type 为 deletion 证明该 key 已经被删除
            // 返回查找失败
            case kTypeDeletion:
                *s = Status::NotFound(Slice());
                return true;
            }
        }
    }
    return false;
}
```

