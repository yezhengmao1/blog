# LRUCache缓存和HashTable实现

## 简介

访问数据库离不开对磁盘文件的访问，而磁盘访问时延远大于内存， `LevelDB` 利用缓存将部分磁盘数据缓存到内存当中，每次读取数据时优先读取缓存，未命中才读取磁盘数据。 `LevelDB` 中采用 `LRUCache` 作为缓存。

读者可以先自行尝试 [LRU缓存](https://leetcode-cn.com/problems/lru-cache/) 这道算法题加深对 `LRUCache` 的理解。

![leveldb-LRUCache](https://yezhem.oss-cn-chengdu.aliyuncs.com/blog_img/leveldb-LRUCache.png)

`LevelDB` 中采用 `HandleTable` （自实现的 `HashTable`） 和两个双向链表来实现 `LRUCache`。

* `HandleTable` 采用可扩容的桶和单向链表实现，默认桶大小和容量为 `4` ，每次扩容桶容量翻倍。处理哈希冲突时采用挂链机制，将节点挂载到对应桶链表的尾部。
* `HandleTable` 支持采用替换方式写入相同 `key` 数据，新 `key` 的 `value` 将会替换老 `key` 的 `value` 。
* 采用双向链表来管理节点，节点插入到 `lru` 头节点之前。则 `lru` 节点的前一个节点为最新访问节点，后一个节点为最老访问节点。当插入节点到达设定容量最大值时，需要淘汰最老节点，按如上分析直接淘汰 `lru` 的头节点的下一个节点即可，但是当该节点正在访问中显然不能被淘汰，需要继续选择次老节点，为方便操作，将正在访问中的节点挂在 `in_use_` 链表中缓存，以次直接淘汰 `lru` 链表中节点。
* `LRUCache` 读写互斥，当 `HandleTable` 发生扩容时会阻塞读操作，为了使锁粒度减小，采用 `ShardedLRUCache` 封装多个 `LRUCache` 来分散锁的粒度。
* 节点的析构采用手动控制引用计数，即使用 `Ref` 和 `Unref` 接口，同时需要析构函数 `deleter` 配合。

上述分析回答了如下几个问题：

* 为什么要使用多个 `LRUCache` ?
* 为什么要使用两个双向链表 `lru_` 和 `in_use_` ?

## 实现

### LRUHandle - 节点定义

```cpp showLineNumbers
// 双向链表和HandleTable中节点数据 - LRUHandle
struct LRUHandle {
    void *value; // 值
    void (*deleter)(const Slice &, void *value); // 析构器，外部申请内存，引用计数为0调用
    LRUHandle *next_hash; // 作为Hash桶单向链表节点的下一个节点
    LRUHandle *next;      // 作为双向链表的下一个节点
    LRUHandle *prev;      // 作为双向链表的上一个节点
    size_t charge;     // 目前没用，表权重
    size_t key_length; // key的长度，LRUHandle中的data域存放key数据，可动态扩展
    bool in_cache;     // 表示cache中是否有该元素，仅析构、相同 key 代替、需要淘汰时标记
    uint32_t refs;     // 引用计数
    uint32_t hash;     // Hash(key)保存一份避免多次求
    char key_data[1];  // key数据域

    Slice key() const {
        assert(next != this);
        // 简单包装 key_data 域
        return Slice(key_data, key_length);
    }
};
```

### HandleTable - 哈希表实现

```cpp showLineNumbers
// HandleTable 线程不安全，需要外部保证
class HandleTable {
private:
    uint32_t length_;   // hash桶大小
    uint32_t elems_;    // 元素个数
    LRUHandle **list_;  // hash桶链表，指针数组形式
public:
    // 构造默认为0，通过 resize 重新设置内存大小
    HandleTable() : length_(0), elems_(0), list_(nullptr) {
        Resize();
    }
    // 析构将桶全部删除
    ~HandleTable() {
        delete[] list_;
    }
private:
  	// 扩桶
    void Resize() {
        // 默认最小桶为4，每次扩大增加一倍
        uint32_t new_length = 4;
        while (new_length < elems_) {
            new_length *= 2;
        }
        // 开辟堆空间，并且初始化为 0 
        LRUHandle **new_list = new LRUHandle *[new_length];
        memset(new_list, 0, sizeof(new_list[0]) * new_length);
        uint32_t count = 0;
        // 遍历老桶
        // 取老桶中头节点，放到新桶中
        // 注意使用二级指针，放到新桶时采用头插
        for (uint32_t i = 0; i < length_; i++) {
            LRUHandle *h = list_[i];
            while (h != nullptr) {
                LRUHandle *next = h->next_hash;
                uint32_t hash = h->hash;
                LRUHandle **ptr = &new_list[hash & (new_length - 1)];
                // 将取出的老节点执行，新桶的第一个节点
                h->next_hash = *ptr;
                // 设置新桶的第一个节点
                *ptr = h;
                h = next;
                count++;
            }
        }
        // 重新设置大小，释放内存
        assert(elems_ == count);
        delete[] list_;
        list_ = new_list;
        length_ = new_length;
    }
    
    // 在桶中查找 key
    // 1.通过hash值找到桶的位置
    // 2.遍历节点即可，没有则为 nullptr，即返回指针指向最后一个节点的next_hash域
    LRUHandle **FindPointer(const Slice &key, uint32_t hash) {
        LRUHandle **ptr = &list_[hash & (length_ - 1)];
        while (*ptr != nullptr && ((*ptr)->hash != hash || key != (*ptr)->key())) {
            ptr = &(*ptr)->next_hash;
        }
        return ptr;
    }
public:
    // 根据 key 查找，返回其指针
    LRUHandle *Lookup(const Slice &key, uint32_t hash) {
        return *FindPointer(key, hash);
    }
    
    // 插入元素
    LRUHandle *Insert(LRUHandle *h) {
        // 查找 key 是否存在
        LRUHandle **ptr = FindPointer(h->key(), h->hash);
        LRUHandle *old = *ptr;
        // 如果存在相同节点，替换该节点
        h->next_hash = (old == nullptr ? nullptr : old->next_hash);
        // 将节点替换，要么是老节点位置，要么是最后一个节点位置
        *ptr = h;
        if (old == nullptr) {
            ++elems_;
            // 链表增加新元素，需要判断是否扩容
            if (elems_ > length_) {
                Resize();
            }
        }
        // 返回老节点
        return old;
    }
    
    // 移除 key
    LRUHandle *Remove(const Slice &key, uint32_t hash) {
        // 查找
        LRUHandle **ptr = FindPointer(key, hash);
        LRUHandle *result = *ptr;
        // 不为空的前提，直接从链表中移除
        if (result != nullptr) {
            *ptr = result->next_hash;
            --elems_;
        }
        return result;
    }

};
```

### LRUCache - LRU缓存实现

```cpp showLineNumbers
// 访问线程安全
class LRUCache {
private:
    // 缓存节点的容量，超过了需要将多余的移除
    size_t capacity_;

    mutable port::Mutex mutex_;
    // 用来计算用量，前面的 charge 参数累加
    size_t usage_ GUARDED_BY(mutex_);
	
   	// 由于读写 LRUHandle 和 HandleTable 是线程不安全，这里使用 mutex 同步
    LRUHandle lru_ GUARDED_BY(mutex_);
    LRUHandle in_use_ GUARDED_BY(mutex_);
    // hash 表 H
    HandleTable table_ GUARDED_BY(mutex_);
public:
    // 初始化双向链表指向自己
    LRUCache() : capacity_(0), usage_(0) {
    	lru_.next = &lru_;
    	lru_.prev = &lru_;
    	in_use_.next = &in_use_;
    	in_use_.prev = &in_use_;
	}
    // 析构函数
    ~LRUCache() {
        // 强校验是否还有元素没有 Release 掉，还在使用
    	assert(in_use_.next == &in_use_);
        // 遍历 lru_ 链表
    	for (LRUHandle *e = lru_.next; e != &lru_;) {
        	LRUHandle *next = e->next;
        	assert(e->in_cache);
        	e->in_cache = false;
        	assert(e->refs == 1);
            // 强校验并减少引用计数，触发其析构器
        	Unref(e);
        	e = next;
    	}
	}
}

// 链表的操作
// 双向链表移除
// 修改前一个节点的下一个
// 修改后一个节点的前一个
void LRUCache::LRU_Remove(LRUHandle *e) {
    e->next->prev = e->prev;
    e->prev->next = e->next;
}

// 添加函数，采用 append 方式，即插入头节点之前
void LRUCache::LRU_Append(LRUHandle *list, LRUHandle *e) {
    e->next = list;
    e->prev = list->prev;
    e->prev->next = e;
    e->next->prev = e;
}

// 对于处理节点的两个辅助函数
// Ref 使节点的引用计数 +1
// UnRef 使节点的引用计数 -1
// 引用计数默认1，变为 >1 时，从 lru_ 链表移除，加入到 in_use_ 链表
// 表示正在被使用
void LRUCache::Ref(LRUHandle *e) {
    if (e->refs == 1 && e->in_cache) { 
        LRU_Remove(e);
        LRU_Append(&in_use_, e);
    }
    e->refs++;
}

// 当使用完成后外部调用 Release 接口，引用计数变为1时
// 从 in_use_ 链表移除，放回 lru_ 链表
// 引用计数变为0时，代表需要析构，外部需要先移除，这里仅调用其析构器
void LRUCache::Unref(LRUHandle *e) {
    assert(e->refs > 0);
    e->refs--;
    if (e->refs == 0) { 
        assert(!e->in_cache);
        (*e->deleter)(e->key(), e->value);
        free(e);
    } else if (e->in_cache && e->refs == 1) {
        LRU_Remove(e);
        LRU_Append(&lru_, e);
    }
}

// 查找，直接从 hashtable 里面查找即可
// 找到后增加引用计数，代表被外部使用，从而放入 in_use_ 链表
Cache::Handle *LRUCache::Lookup(const Slice &key, uint32_t hash) {
    MutexLock l(&mutex_);
    LRUHandle *e = table_.Lookup(key, hash);
    if (e != nullptr) {
        Ref(e);
    }
    return reinterpret_cast<Cache::Handle *>(e);
}

// 使用完成显示调用 Release 减少引用计数
void LRUCache::Release(Cache::Handle *handle) {
    MutexLock l(&mutex_);
    Unref(reinterpret_cast<LRUHandle *>(handle));
}

// 删除节点
bool LRUCache::FinishErase(LRUHandle *e) {
    if (e != nullptr) {
        assert(e->in_cache);
        // 在双向链表中删除
        LRU_Remove(e);
        e->in_cache = false;
        usage_ -= e->charge;
        // 引用计数归0，如果外部还在使用它，外部应该会显示将其归0
        Unref(e);
    }
    return e != nullptr;
}
// 删除节点，参数接受为 key 和 hash 值
// 先找到节点，进行删除
void LRUCache::Erase(const Slice &key, uint32_t hash) {
    MutexLock l(&mutex_);
    FinishErase(table_.Remove(key, hash));
}

// 清理节点，遍历 lru_ 链表进行清理即可
void LRUCache::Prune() {
    MutexLock l(&mutex_);
    while (lru_.next != &lru_) {
        LRUHandle *e = lru_.next;
        assert(e->refs == 1);
        bool erased = FinishErase(table_.Remove(e->key(), e->hash));
        if (!erased) {
            assert(erased);
        }
    }
}

// 插入节点，需要传入key和hash和value和charge和析构器
Cache::Handle *LRUCache::Insert(const Slice &key, uint32_t hash, void *value,
                                size_t charge,
                                void (*deleter)(const Slice &key, void *value)) {
    MutexLock l(&mutex_);
    // 申请内存，LRUHandle尾部需要动态增加空间用于拷贝key的值
    LRUHandle *e =
        reinterpret_cast<LRUHandle *>(malloc(sizeof(LRUHandle) - 1 + key.size()));
    e->value = value;
    e->deleter = deleter;
    e->charge = charge;
    e->key_length = key.size();
    e->hash = hash;
    e->in_cache = false;
    // 默认引用计数为1
    e->refs = 1; 
    // 拷贝key的数据
    std::memcpy(e->key_data, key.data(), key.size());

    // 容量如果 <0 证明不需要缓存
    // 插入时，默认引用计数为2，因为需要将该节点返回给上层使用，放在 in_use_ 链表
    // 插入hashTable时遇见重复的key，将其删除
    if (capacity_ > 0) {
        e->refs++;
        e->in_cache = true;
        LRU_Append(&in_use_, e);  
        usage_ += charge;
        FinishErase(table_.Insert(e));
    } else {
        e->next = nullptr;
    }
    // 大于容量，取 lru_ 的下一个，即最老未使用节点进行删除
    while (usage_ > capacity_ && lru_.next != &lru_) {
        LRUHandle *old = lru_.next;
        assert(old->refs == 1);
        bool erased = FinishErase(table_.Remove(old->key(), old->hash));
        if (!erased) {
            assert(erased);
        }
    }
	// 返回给上层使用
    return reinterpret_cast<Cache::Handle *>(e);
}
```

### ShardedLRUCache 实现

```cpp showLineNumbers
static const int kNumShardBits = 4;
static const int kNumShards = 1 << kNumShardBits
    
class ShardedLRUCache : public Cache {
private:
    // 如上图所示，有16个LRUCache
    LRUCache shard_[kNumShards];
    // 提供递增序号 last_id_ 用于表示唯一 cache 方便共享使用
    port::Mutex id_mutex_;
    uint64_t last_id_;
	// 计算 hash 函数
    static inline uint32_t HashSlice(const Slice &s) {
        return Hash(s.data(), s.size(), 0);
    }
    // 将 hash 函数控制到 4 bit 即 <16 放入对应 LRUCache 中
    static uint32_t Shard(uint32_t hash) {
        return hash >> (32 - kNumShardBits);
    }
public:
    // 递增序号 last_id_
    uint64_t NewId() override {
        MutexLock l(&id_mutex_);
        return ++(last_id_);
    }
    // 容量平摊到每一个LRUcache
    explicit ShardedLRUCache(size_t capacity) : last_id_(0) {
        const size_t per_shard = (capacity + (kNumShards - 1)) / kNumShards;
        for (int s = 0; s < kNumShards; s++) {
            shard_[s].SetCapacity(per_shard);
        }
    }
    ~ShardedLRUCache() override {
    }
    // 插入，先计算在哪个LRUCache，插入即可
    Handle *Insert(const Slice &key, void *value, size_t charge,
                   void (*deleter)(const Slice &key, void *value)) override {
        const uint32_t hash = HashSlice(key);
        return shard_[Shard(hash)].Insert(key, hash, value, charge, deleter);
    }
    // 查找，先计算在哪个LRUCache，查找即可
    Handle *Lookup(const Slice &key) override {
        const uint32_t hash = HashSlice(key);
        return shard_[Shard(hash)].Lookup(key, hash);
    }
    // 释放引用，同理计算在哪个LRUCache
    void Release(Handle *handle) override {
        LRUHandle *h = reinterpret_cast<LRUHandle *>(handle);
        shard_[Shard(h->hash)].Release(handle);
    }
    // 删除，同上
    void Erase(const Slice &key) override {
        const uint32_t hash = HashSlice(key);
        shard_[Shard(hash)].Erase(key, hash);
    }
    // 返回节点值
    void *Value(Handle *handle) override {
        return reinterpret_cast<LRUHandle *>(handle)->value;
    }
    // 都是对 LRUCache 的封装
	void Prune() override {
        for (int s = 0; s < kNumShards; s++) {
            shard_[s].Prune();
        }
    }
    size_t TotalCharge() const override {
        size_t total = 0;
        for (int s = 0; s < kNumShards; s++) {
            total += shard_[s].TotalCharge();
        }
        return total;
    }
};
```

