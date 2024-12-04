# Breaking the computation and communication abstraction barrier in distributed machine learning workloads

## 简介

这篇文章主要是想将通信和计算统一起来进行优化（在这之前通信和计算都是独立优化的）。统一之后将会有更多的优化空间：Interface 优化，这种优化指通信不需要缓冲区去缓存需要的数据，然后用于计算，可以直接将通信的输出作为计算的输入； Fusion 优化，和算子融合类似，考虑将通信和计算优化为单一 kernel；Reorder 优化，重排计算和通信顺序，因此能够提供更多的融合机会；Overlapping 优化，完全利用计算和通信资源。

为了获得上述优化，作者提出了一个框架 CoCoNET，包括：DSL语言（Domain Specific Language）来表示计算和通信操作；AutoTunner来将DSL表述的模型转化为一种调度（Scheduling）语言；Code Generator来从调度语言中生成高性能的计算和通信kernel。工作流程如图：

<div style={{ textAlign: 'center' }}>
  <img src="https://yezhem.oss-cn-chengdu.aliyuncs.com/blog_img/image-20240816185642795.png" style={{ width: '100%' }}/>
</div>

注：整篇文章看下来，感觉解法还是在做手工活。提出了一种优化思路，但是具体实现还是手工去替换的。

### DSL

DSL 这块的表述和 Torch 基本差不多，但是支持的算子特别少，论文中仅考虑如下算子，如表：

<div style={{ textAlign: 'center' }}>
  <img src="https://yezhem.oss-cn-chengdu.aliyuncs.com/blog_img/image-20240816185810388.png" style={{ width: '50%' }}/>
</div>
### Transformations

这一部分主要讲如何把DSL定义的模型转化为Schedule语言表示。主要有以下几个步骤：通信算子切分（all-reduce切为reduce-scatter和all-gather）；重排算子（为融合算子提供机会）；算子融合（融合通信和计算）；重叠通信和计算。这一节还提了下 autotunner ，就是使用了 BFS 去搜索全部空间（这里文章就写了一段话，完全没说清如何得到最优解）。

<div style={{ textAlign: 'center' }}>
  <img src="https://yezhem.oss-cn-chengdu.aliyuncs.com/blog_img/image-20240816192832020.png" style={{ width: '100%' }}/>
</div>

几个小优化：Adam优化器的优化，PP并行中的P2P通信和all-reduce结合在一起的优化

### Code Generator

这一部分的工作就是将之前的Schedule语言表示转化为kernel代码。看他们的描述就是去魔改了下NCCL库。然后在其中手工插入计算，直接将通信结果拿给计算代码用，省掉了中间 buffer 的过程。
