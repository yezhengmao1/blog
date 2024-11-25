---
id: section1
---
# Arena 内存管理

## 简介

`arena` 这个单词在计算机领域中常表示一段连续的内存区域。

`LevelDB` 提供了 `arena` 这样的简单内存分配器来代替直接使用 `malloc` 分配一些小内存，其不支持释放内存，仅支持分配内存，内存释放的时机是在析构 `arena` 时发生，此时将会释放所有通过 `arena` 分配出来的内存。

所以 `arena` 适合内存不断增加，且会常驻内存不需要随时释放的场景。

![leveldb-Arena-0](https://yezhem.oss-cn-chengdu.aliyuncs.com/blog_img/leveldb-Arena-0.png)

内存分配如图，直接从固定大小的内存块中分配 `size` 大小的内存，返回其地址即可。使用 `alloc_bytes_remaining_` 变量来记录当前内存块还剩余多少字节， `alloc_ptr_` 遍历来记录在内存块中可以分配的起始地址。

如果当前块不够分配，`arena` 采用如下策略进行分配：

* 当前块足够分配，直接按上文所述分配即可。
* 当前块不足分配，且分配大小大于 `1/4` 块内存大小，生成分配所需大小的内存块，返回新内存块地址，下次分配使用未分配完的内存块。
* 当前块不足分配，且分配大小小于 `1/4` 块内存大小，生成新的内存块，分配使用新的内存块，老的内存块剩余内存不使用。

## 实现

### 构造函数

```c++
class Arena {
public:
    Arena();

    Arena(const Arena &) = delete;
    Arena &operator=(const Arena &) = delete;
private:
    // 如上图，alloc_ptr_ 表示当前可分配内存起始地址
    // alloc_bytes_remaining_ 当前块剩余内存大小
    char *alloc_ptr_;
    size_t alloc_bytes_remaining_;
    // 用来存放所有块的起始地址
    std::vector<char *> blocks_;
	// 内存使用率
    std::atomic<size_t> memory_usage_; 
}

// 构造函数默认直接使用初始值
Arena::Arena() : alloc_ptr_(nullptr), alloc_bytes_remaining_(0), memory_usage_(0) {
}

// 每一块的内存大小
static const int kBlockSize = 4096;
```

### 析构函数

```c++
// 析构时，把所有 new 出来的内存 delete 掉
// 注意使用 delete[]，因为 new 的时候使用的是 new char[]
Arena::~Arena() {
    for (size_t i = 0; i < blocks_.size(); i++) {
        delete[] blocks_[i];
    }
}
```

### 内存分配

提供两种分配：内存对齐和不对齐分配，分配思路和简介中描述一致，具体看代码。

```c++
inline char *Arena::Allocate(size_t bytes) {
    assert(bytes > 0);
    // 如果当前块比需要的多，直接返回 alloc_ptr_ 地址
    // 然后 alloc_ptr_ 往下增加相应大小
    // 剩余内存 alloc_bytes_remaining_ 减小相应大小
    if (bytes <= alloc_bytes_remaining_) {
        char *result = alloc_ptr_;
        alloc_ptr_ += bytes;
        alloc_bytes_remaining_ -= bytes;
        return result;
    }
    // 不够分配，调用下面函数去处理简介中描述的两种策略
    return AllocateFallback(bytes);
}

char *Arena::AllocateFallback(size_t bytes) {
    // 分配内存大于 1/4 的块内存大小，直接分配 bytes 大小的块并返回
    if (bytes > kBlockSize / 4) {
        char *result = AllocateNewBlock(bytes);
        return result;
    }

    // 分配内存小于 1/4 的块内存大小
    // 老内存块剩余内存不需要了，这样每个内存块最多浪费小于 1/4 * kBlocksize 字节的内存
    alloc_ptr_ = AllocateNewBlock(kBlockSize);
    alloc_bytes_remaining_ = kBlockSize;

    // 和Allocate函数逻辑相同
    char *result = alloc_ptr_;
    alloc_ptr_ += bytes;
    alloc_bytes_remaining_ -= bytes;
    return result;
}

// 生成新的内存块
// 直接 new char[] 出来，地址放在 blocks_ 中即可，释放时使用
char *Arena::AllocateNewBlock(size_t block_bytes) {
    char *result = new char[block_bytes];
    blocks_.push_back(result);
    // block_bytes + sizeof(char *) 
    // 加 sizeof(char*) 难道是因为 vector<char*> 中的地址也要统计
    // 但是 vector<> 内存容量不是大于 size 吗
    memory_usage_.fetch_add(block_bytes + sizeof(char *), std::memory_order_relaxed);
    return result;
}

// 分配对齐的内存
char *Arena::AllocateAligned(size_t bytes) {
    // 地址按照 align 字节对齐
    const int align = (sizeof(void *) > 8) ? sizeof(void *) : 8;
    static_assert((align & (align - 1)) == 0, "Pointer size should be a power of 2");
    // slop 用于计算下还差多少字节才能对齐
    // 按照对齐来分配 needed = slop + bytes
    // 最后 slop 部分不需要，浪费掉即可，剩余的 bytes 字节保证是对齐的
    // 例如目前内存如图所示，xxx已经分配，需要按 8 字节对齐分配 4 字节的内存
    // xxx-----
    // --------
    // 则 xxx 那行的字节不分配，slop = 5，返回 AAAA 的字节地址
    // xxxooooo
    // AAAA----
    size_t current_mod = reinterpret_cast<uintptr_t>(alloc_ptr_) & (align - 1);
    size_t slop = (current_mod == 0 ? 0 : align - current_mod);
    size_t needed = bytes + slop;
    char *result;
    if (needed <= alloc_bytes_remaining_) {
        result = alloc_ptr_ + slop;
        alloc_ptr_ += needed;
        alloc_bytes_remaining_ -= needed;
    } else {
        // 对齐之后超过了，直接来个新的块
        // new 出来的一定是内存对齐的，编译保证
        result = AllocateFallback(bytes);
    }
    assert((reinterpret_cast<uintptr_t>(result) & (align - 1)) == 0);
    return result;
}
```