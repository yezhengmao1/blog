# Varint变长整数编码

## 简介

`LevelDB` 提供一种序列化方法，将定长数据编码为变长数据。例如 `int32_t` 类型变量在内存中为 `4` 字节其值为 `0x01 0x00 0x00 0x00`，是否可以仅用 `1` 个字节 `0x01` 就能够存放该数据。

本文为了方便，数据表示为 `0x01 0x02 0x03 0x04` 单字节的形式代表从低地址到高地址字节分配为 `0x01 0x02 0x03 0x04` ， 而在代码中 `int32_t` 类型变量形式为 `0x04030201` ，其低地址在右端。

如上诉所示，如果存入数据为 `0x01` 解码时如何确定下一个字节 `0x02` 不属于需要解码的部分。可以引入一个比特位代表下一个字节是否属于需要解码数据，那么一个字节有效部分仅有 `7` 个比特位，通常将该比特位放在最高位。

其编码思路如下：

* 将当前定长数据划分为 `7` 比特一组的数据，将高位为 `0` 舍去，例如下图 `0x00004203` 可以划分为 `3` 组。
* 将每 `7` 比特数据加上最高位 `1` 比特数据组成新的 `1` 字节数据，其中最高比特代表下一字节是否属于需要解码部分。

下图展示了如何将 `0x00004203` 编码为 `0x018483` 。将 `4` 字节数据压缩为 `3` 字节，由此可见定长 `4` 字节数据可以编码为 `1 ~ 5` 字节的变成数据。

其解码思路即为编码逆向操作：

* 取 `1` 字节数据，判断最高比特位是否为 `1` ，如果为 `1` ，取剩余 `7` 比特数据，拼接到结果中，继续取下一个字节数据操作。
* 如果最高比特位为 `0` ，拼接后结束。

![leveldb-Varint-0](https://yezhem.oss-cn-chengdu.aliyuncs.com/blog_img/leveldb-Varint-0.png)

## 实现

### 编码

```cpp showLineNumbers
// 判断 7 bit 一组需要多少组
// 即编码后需要多少字节
int VarintLength(uint64_t v) {
    int len = 1;
    while (v >= 128) {
        v >>= 7;
        len++;
    }
    return len;
}

// 编码部分，直接采用硬编码形式进行数据处理
// 判断该数 7 bit 一组能分为多少组，即编码后需要多少字节
// 对 7 bit 数据前面加上 1bit 的 1，即 | B
// 最高位组不需要 | B 已经保证高位比特位为 0 
char *EncodeVarint32(char *dst, uint32_t v) {
    uint8_t *ptr = reinterpret_cast<uint8_t *>(dst);
    static const int B = 128;
    if (v < (1 << 7)) {
        *(ptr++) = v;
    } else if (v < (1 << 14)) {
        *(ptr++) = v | B;
        *(ptr++) = v >> 7;
    } else if (v < (1 << 21)) {
        *(ptr++) = v | B;
        *(ptr++) = (v >> 7) | B;
        *(ptr++) = v >> 14;
    } else if (v < (1 << 28)) {
        *(ptr++) = v | B;
        *(ptr++) = (v >> 7) | B;
        *(ptr++) = (v >> 14) | B;
        *(ptr++) = v >> 21;
    } else {
        *(ptr++) = v | B;
        *(ptr++) = (v >> 7) | B;
        *(ptr++) = (v >> 14) | B;
        *(ptr++) = (v >> 21) | B;
        *(ptr++) = v >> 28;
    }
    return reinterpret_cast<char *>(ptr);
}
```

## 解码

```cpp showLineNumbers
// 解码函数入口，主要判断内存是否超出
bool GetVarint32(Slice *input, uint32_t *value) {
    const char *p = input->data();
    const char *limit = p + input->size();
    const char *q = GetVarint32Ptr(p, limit, value);
    if (q == nullptr) {
        return false;
    } else {
        *input = Slice(q, limit - q);
        return true;
    }
}

// 如果 1 字节直接返回结果即可
inline const char *GetVarint32Ptr(const char *p, const char *limit, uint32_t *value) {
    if (p < limit) {
        uint32_t result = *(reinterpret_cast<const uint8_t *>(p));
        if ((result & 128) == 0) {
            *value = result;
            return p + 1;
        }
    }
    return GetVarint32PtrFallback(p, limit, value);
}

// 大于 1 字节，取 1 字节数据，判断最高位 & 128 是否为 1
// 是 1 需要继续取
// 不是 1 拼上这部分数据返回即可
// 拼接数据操作直接将 7bit 数据 & 127 部分右移然后取 | 即可
const char *GetVarint32PtrFallback(const char *p, const char *limit, uint32_t *value) {
    uint32_t result = 0;
    for (uint32_t shift = 0; shift <= 28 && p < limit; shift += 7) {
        uint32_t byte = *(reinterpret_cast<const uint8_t *>(p));
        p++;
        if (byte & 128) {
            // More bytes are present
            result |= ((byte & 127) << shift);
        } else {
            result |= (byte << shift);
            *value = result;
            return reinterpret_cast<const char *>(p);
        }
    }
    return nullptr;
}
```

## 其他

`64bit` 的数据操作同理。