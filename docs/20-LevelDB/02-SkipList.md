# SkipList跳表

## 简介

单向有序链表查找、插入和删除操作时间复杂度为 `O(n)` ，若在已查找到节点前提下，进行插入和删除时间复杂度为 `O(1)` 。

对于单向有序链表，如果能够像有序数组一样进行二分查询，那么查询时间复杂度就能控制在 `O(logn)` 级别。

基于这样的思路，可以创建多条单向有序链表，在理想状态下，每条链表中的节点个数都是上一条链表的一半，假设单向有序链表中有 8 个节点，那么理想情况下可以创建 `log8 = 3` 条链表。所有 8 个节点出现在第 0 层链表， 4 个节点出现在第 1 层链表， 2 个节点出现在第 2 层链表。

如此这般就能构造出跳表结构，如下图所示。

<div style={{ textAlign: 'center' }}>
  <img src="https://yezhem.oss-cn-chengdu.aliyuncs.com/blog_img/leveldb-SkipList-1.png" style={{ width: '100%' }}/>
</div>


在这种理想情况下，查找效率变为 `O(logn)` ，例如查找节点 4 流程如下：

1. 首先访问 level2 层，查找到节点 5 时，大于节点 4 ，需要进入节点 1 的下一层。

<div style={{ textAlign: 'center' }}>
  <img src="https://yezhem.oss-cn-chengdu.aliyuncs.com/blog_img/leveldb-SkipList-2.png" style={{ width: '100%' }}/>
</div>

2. 访问节点 1 的 level1 层，经过节点 3 ，访问节点 5 时，需要进入节点 3 的下一层。

<div style={{ textAlign: 'center' }}>
  <img src="https://yezhem.oss-cn-chengdu.aliyuncs.com/blog_img/leveldb-SkipList-3.png" style={{ width: '100%' }}/>
</div>

3. 访问节点 3 的 level0 层，找到目标节点。

<div style={{ textAlign: 'center' }}>
  <img src="https://yezhem.oss-cn-chengdu.aliyuncs.com/blog_img/leveldb-SkipList-4.png" style={{ width: '100%' }}/>
</div>

由于链表的构建是动态过程，无法知道某个节点在最优情况下需要处于哪些层，跳表通过随机化的方式来解决这个问题，具体为使第 i 层的节点有概率 p 出现在 i + 1 层。

即最终构建出，第 0 层有 n 个节点，期望第 1 层有 n/p 个节点，第 2 层有 n/(p ^ 2) 个节点，第 k 层有 n/(p ^ k) 个节点，每一个节点在插入时根据随机概率计算其出现的层数。

在 `LevelDB` 中的 `SkipList` 还支持多线程访问，对于写操作需要在外部进行加锁，保证只有一个线程写，而对于读操作可以与写操作和多个读操作同时进行。

## 实现

### 模板参数

```cpp showLineNumbers
// Key        - 插入的数据类型
// Comparator - 比较器，对 Key 类型数据进行比较，重载 bool operator() 函数
template <typename Key, class Comparator> class SkipList {};
```

### 构造函数

```cpp showLineNumbers
// 链表节点
template <typename Key, class Comparator>
struct SkipList<Key, Comparator>::Node {
    // 存放数据，类型为 Key
    Key const key;
private:
    // 存放链表指针
    // 这里为了节省内存，动态分配内存，例如简介中节点 2 就不需要分配 next_[2]
    std::atomic<Node *> next_[1];
public:
    // 提供设置或读 next_ 数组接口
    Node *Next(int n) {
        return next_[n].load(std::memory_order_acquire);
    }
    void SetNext(int n, Node *x) {
        next_[n].store(x, std::memory_order_release);
    }
    // NoBarrier效率更高
    // 假设有两个线程同时执行 t1 和 t2 
    // 可能出现 1 3 的输出，因为指令重排之后会导致 b = 3 先于 a = 2 执行
    // std::memory_order_release 可以保证前面的不能在我之后执行 
    // std::memory_order_acquire 可以保证后面的不能在我之前执行
    /*
        int a = 1;
        int b = 1;
    	void t1() {
    		a = 2;
    		b = 3;
    	}
    	void t2() {
    	    cout << a << endl;
    	    cout << b << endl;
    	}
    */
    Node *NoBarrier_Next(int n) {
        return next_[n].load(std::memory_order_relaxed);
    }
    void NoBarrier_SetNext(int n, Node *x) {
        next_[n].store(x, std::memory_order_relaxed);
    }
};

// 链表节点的创建
template <typename Key, class Comparator>
typename SkipList<Key, Comparator>::Node *
SkipList<Key, Comparator>::NewNode(const Key &key, int height) {
    // 此处分配内存需要对齐
    // 内存大小为 sizeof(Node) 和动态扩展的 next_ 数组 
    // height - 1 是因为 Node 内部已经有 1 个 Node* 了
    char *const node_memory = arena_->AllocateAligned(
        sizeof(Node) + sizeof(std::atomic<Node *>) * (height - 1));
    // 分配好内存，手动构造下，这就是 new 和 malloc 区别
    // new Node(); 分配内存并构造
    // new (node_memory) Node(); 在 node_memory 地址进行构造
    return new (node_memory) Node(key);
}

// SkipList
template <typename Key, class Comparator> 
class SkipList {
    // 比较器，const 变量
    Comparator const compare_; 
    // 内存分配器，const 变量
    Arena *const arena_;   
    // 头节点，const 变量
    Node *const head_;	
    // 最大高度，优化访问
    std::atomic<int> max_height_; 
    // 伪随机器
    Random rnd_;                  
};

// SkipList 构造
template <typename Key, class Comparator>
SkipList<Key, Comparator>::SkipList(Comparator cmp, Arena *arena)
    : compare_(cmp), // 比较器
      arena_(arena), // 内存分配器，见 arena 源码
      // 头节点，dummy 作用
      head_(NewNode(0, kMaxHeight)),  
	  // 表示目前跳表最大层
      max_height_(1), 
      // 简单的伪随机器，传入随机种子
      rnd_(0xdeadbeef) {
    for (int i = 0; i < kMaxHeight; i++) {
        // 初始化头节点的 next 字段为空
        head_->SetNext(i, nullptr);
    }
}
```

### 查找

```cpp showLineNumbers
// 直接调用 comparator 比较器比较
// 因为链表是按照升序排列，如果 n->key 小于 key，即 key 应该在 n 之后
template <typename Key, class Comparator>
bool SkipList<Key, Comparator>::KeyIsAfterNode(const Key &key, Node *n) const {
    return (n != nullptr) && (compare_(n->key, key) < 0);
}

// 比较是否相等
bool Equal(const Key &a, const Key &b) const {
    return (compare_(a, b) == 0);
}

// 查找每层链表第一个大于 key 的节点
// 第 i 层的前一个节点放在 prev[i] 数组中
// 从最高层开始，和简介操作描述一致
template <typename Key, class Comparator>
typename SkipList<Key, Comparator>::Node *
SkipList<Key, Comparator>::FindGreaterOrEqual(const Key &key, Node **prev) const {
    Node *x = head_;
    int level = GetMaxHeight() - 1;
    while (true) {
        // 判断下一个节点是否大于 key 值
        // 如果小于，继续迭代下一个即可
        // 如果大于，需要查找下一层
        Node *next = x->Next(level);
        if (KeyIsAfterNode(key, next)) {
            x = next;
        } else {
            if (prev != nullptr)
                prev[level] = x; // 记录下 prev 前一个节点
            if (level == 0) { // 最后一层了直接返回
                return next;
            } else {
                level--; // 下一层
            }
        }
    }
}

// 找到小于 key 的前一个节点
// 仍然从最高层开始
// 如果下一个节点的值大于或等于则进入下一层
template <typename Key, class Comparator>
typename SkipList<Key, Comparator>::Node *
SkipList<Key, Comparator>::FindLessThan(const Key &key) const {
    Node *x = head_;
    int level = GetMaxHeight() - 1;
    while (true) {
        assert(x == head_ || compare_(x->key, key) < 0);
        Node *next = x->Next(level);
        // 下一个节点大于等于 key，要查找下一层
        // 否则该层继续查找小于 key 的节点
        if (next == nullptr || compare_(next->key, key) >= 0) {
            if (level == 0) {
                return x;
            } else {
                level--;
            }
        } else {
            x = next;
        }
    }
}

// 查看跳表是否有相同的 Key
template <typename Key, class Comparator>
bool SkipList<Key, Comparator>::Contains(const Key &key) const {
    // 直接查找第一个大于或者等于的节点，然后比较是否相同即可
    Node *x = FindGreaterOrEqual(key, nullptr);
    if (x != nullptr && Equal(key, x->key)) {
        return true;
    } else {
        return false;
    }
}

// 找最后一个节点，即 key 最大节点
// 利用跳表性质，层数越高，节点越少，“跳”得越快
// 直接从最高层开始遍历，到达第 0 层为止
template <typename Key, class Comparator>
typename SkipList<Key, Comparator>::Node *SkipList<Key, Comparator>::FindLast() const {
    Node *x = head_;
    int level = GetMaxHeight() - 1;
    while (true) {
        Node *next = x->Next(level);
        if (next == nullptr) {
            if (level == 0) {
                return x;
            } else {
                level--;
            }
        } else {
            x = next;
        }
    }
}
```

### 插入

```cpp showLineNumbers
// 随机一个高度值
template <typename Key, class Comparator> int SkipList<Key, Comparator>::RandomHeight() {
    static const unsigned int kBranching = 4;
    int height = 1;
    // 如果随机到的值 %4 == 0，则层数加 1
    // 即在 i 层有 1/4 的概率出现在 i + 1 层
    while (height < kMaxHeight && rnd_.OneIn(kBranching)) {
        height++;
    }
    assert(height > 0);
    assert(height <= kMaxHeight);
    return height;
}

template <typename Key, class Comparator>
void SkipList<Key, Comparator>::Insert(const Key &key) {
    // 使用 prev 记录插入节点的前一个节点
    Node *prev[kMaxHeight];
    // 找到第一个节点，节点值大于或者等于 key
    Node *x = FindGreaterOrEqual(key, prev);
	// 检查插入数据是否相同
    assert(x == nullptr || !Equal(key, x->key));
	// 随机生成插入节点需要出现在哪些层
    int height = RandomHeight();
    // 新增高度
    if (height > GetMaxHeight()) {
        for (int i = GetMaxHeight(); i < height; i++) {
            prev[i] = head_;
        }
        // 这里访问加不加锁不影响其他线程读，具体为如下两种情况
        // 已经修改 max_height_ 高度但是没有加入该节点，访问 nullptr 直接会跳过
        // 加入该节点使用的是 SetNext 接口，这条命令保证执行，可以正常访问新加入的节点
        max_height_.store(height, std::memory_order_relaxed);
    }
	// 创建节点
    x = NewNode(key, height);
    for (int i = 0; i < height; i++) {
        // 和单链表类似插入类型，处理 height 层条链表即可
        // 使用 NoBarrier 
        x->NoBarrier_SetNext(i, prev[i]->NoBarrier_Next(i));
        // 使用 SetNext 时保证前面的已经执行，即设置好 x 节点的下一个节点了
        // 如果这里还用 NoBarrier 会有什么结果
        // 先设置 prev->next = x 但是 x->next 还是没有设置
        // 其他线程读的时候就会出错
        // 注意到设置顺序是从 0 层开始的，如果从最大层开始，考虑以下情况
        // 查找某节点是否存在，从最大层开始，查找失败，会进入下一层
        // 而该层目前还没有加入链表中，即这个循环还没结束
        // 显然访问的节点 next[i] 为 nullptr，我们判断找不到节点，出现问题
        prev[i]->SetNext(i, x);
    }
}
```

### 迭代器

实现迭代器的访问方式，隐藏跳表的底层存放形式。

```cpp showLineNumbers
class Iterator {
private:
    // list_ 为跳表结构
    // node_ 为当前迭代器指向的节点
    const SkipList *list_;
    Node *node_;
};
// 迭代器初始化，赋值即可 
template <typename Key, class Comparator>
inline SkipList<Key, Comparator>::Iterator::Iterator(const SkipList *list) {
    list_ = list;
    node_ = nullptr;
}
// 当前节点是否为空
template <typename Key, class Comparator>
inline bool SkipList<Key, Comparator>::Iterator::Valid() const {
    return node_ != nullptr;
}
// 直接返回 key
template <typename Key, class Comparator>
inline const Key &SkipList<Key, Comparator>::Iterator::key() const {
    assert(Valid());
    return node_->key;
}
// 全部节点都位于第 0 层，退化为链表，循环第 0 层即可
template <typename Key, class Comparator>
inline void SkipList<Key, Comparator>::Iterator::Next() {
    assert(Valid());
    node_ = node_->Next(0);
}
// 对于单向链表，查找前一个节点只能从头遍历
// 利用跳表查找
// 注意如果是头节点，设置为不能访问
template <typename Key, class Comparator>
inline void SkipList<Key, Comparator>::Iterator::Prev() {
    assert(Valid());
    node_ = list_->FindLessThan(node_->key);
    if (node_ == list_->head_) {
        node_ = nullptr;
    }
}
// 找第一个大于或等于 key 的节点
template <typename Key, class Comparator>
inline void SkipList<Key, Comparator>::Iterator::Seek(const Key &target) {
    node_ = list_->FindGreaterOrEqual(target, nullptr);
}
// 第一个节点
template <typename Key, class Comparator>
inline void SkipList<Key, Comparator>::Iterator::SeekToFirst() {
    node_ = list_->head_->Next(0);
}
// 最后一个节点，同样使用跳表特性，见查找
template <typename Key, class Comparator>
inline void SkipList<Key, Comparator>::Iterator::SeekToLast() {
    node_ = list_->FindLast();
    if (node_ == list_->head_) {
        node_ = nullptr;
    }
}
```
