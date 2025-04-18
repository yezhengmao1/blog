# Lancet: Accelerating Mixture-of-Experts Training via Whole Graph Computation-Communication Overlapping

## 简介

Lancet 这篇工作主要讨论：MoE架构下如何提高通信和计算重叠的机会。
我的评价：实验只用了两种参数规模的GPT2模型（上那么大的集群就训一个GPT2模型，感觉有点...）；实验结果基本集中在端到端性能（如果能给一个重叠前后的 timeline 比较，或与 baseline 比较到底有多少通信被重叠的性能统计会更solid）；文章关于“非MoE部分计算重叠”的动机和挑战描述，文字很难follow（所以下文我对文章的理解可能不太正确）。

这篇文章的观点：作者认为在专家并行（EP，文章的 EP 假设是每个专家分散在不同的 GPU 上，其他部分用数据并行） all-to-all 通信通常要比专家计算时间久。对于非MoE模型已经有很多研究去重叠计算和通信操作，对于MoE模型目前的研究只关注 all-to-all 通信和专家计算重叠，没有考虑更大的范围重叠（non-MoE部分和MoE部分的重叠）。

因此作者提出两种新的重叠模式：

反向传播的重叠（如下图所示），根据链式求导法则，每一个 Transformer block 先计算与 FFN 层相关的导数，然后计算与 Attention 相关的导数。
这里作者认为不优化下的反向传播执行的 timeline 如下图的上侧所示（也即是按照公式分别求权重梯度和输入梯度，然后回传）。由于只有输入梯度是有依赖的，也即是图里面所有$X$直接有依赖，$W$直接没有依赖，那就可以先做所有$X$的求导，再去做$W$的求导，这样就有和 all-to-all 算子的重叠机会了。

comment: 感觉目前 pytorch 已经有这个功能了，这个不太确定？文章的实现是基于 RAF （TVM） 这个 baseline 不确定其优化。然后是 MoE 架构的假设，如下图，先计算 FFN 梯度（左侧），上一层才是替换 FFN 的专家层（右侧）。
难道用的模型是 FFN 和专家层交替的？如果画成左侧一开始就是$dXffn$应该也不影响重叠吧？

<div style={{ textAlign: 'center' }}>
  <img src="https://yezhem.oss-cn-chengdu.aliyuncs.com/blog_img/20241203215824.png" style={{ width: '70%' }}/>
</div>

第二种重叠是前向传播的重叠（如下图），（a）是没有重叠的方式；（b）可以认为是 PP 并行的做法，把输入数据按照 batch 维度划分，然后分块计算来提高重叠率，然后将分块的数据合并来计算后续步骤；（c）b中的方式不合并，下一层的 attention 部分继续用分块的数据算；（d）本质上和 c 是一样，我不合并继续算呗。

comment：这种重叠感觉就完全是 GPipe 这种 pp 并行的玩法了，直接把 mini-batch 的数据拆解为若干 macro-batch 去做计算，提高重叠率。

<div style={{ textAlign: 'center' }}>
  <img src="https://yezhem.oss-cn-chengdu.aliyuncs.com/blog_img/20241203220034.png" style={{ width: '70%' }}/>
</div>

作者认为前向传播如果这样分解输入数据后会带来几个问题：
* 如下图所示，作者假设输入数据经过 Gate 函数后，token 被均分到每个专家，在专家计算完成后，还需要按原理 token 的位置重新收集这些专家的 output，那么你按照 batch size 维度切分后（如图b），我会优先算第一个分块，然后拿到其结果，但我并不能复原为原 output 的样子，因为专家容量有限，第一分块的最后一个 0 只能舍弃。 
* 怎么切分输入数据，才能更有效重叠？（一个 bachsize 为 B 的数据，切成几个，每个多大）

comment：第一个问题感觉假设很弱，他给的解决方法也很简单。不丢弃就行了（图c）。然后这个问题啰啰嗦嗦说了很大篇幅。这样可以看到其实专家的计算会不均匀。还有一点不明白就是为什么整个 batch 的数据需要均分给不同专家（难道不是 batch 数据中的每一条数据嘛）。

<div style={{ textAlign: 'center' }}>
  <img src="https://yezhem.oss-cn-chengdu.aliyuncs.com/blog_img/20241203220933.png" style={{ width: '70%' }}/>
</div>


## Weight gradient computation shedule pass

思路很简单，我这里没太仔细看解法，感觉很啰嗦。就是枚举所有 all-to-all 算子，然后使用贪婪算法求解最大化重叠区域。我感觉直接枚举都能出结果（求解空间又不是特别大，而且依赖模式很固定，$X$的求导显而易见要先处理）。

## Operator partition pass

个人感觉就是简单的输入数据的切分。（你本来输入数据 batch size 就不大，还不如直接暴力出结果），作者这里用的还是常规的动态规划求解。所以主要难点还是在于怎么去预估划分后的数据的通信和计算开销。主要估算得够准，求解才能最优。作者使用 profiling 预先得到计算时间（batch size不大，而且计算的输入大小肯定会固定到一样大，直接枚举嘛），然后使用通信预估模型预测通信时间（all-to-all 通信的 token 数量由 gate 决定，就不知道通信量是多少了，测几个点拟合，这里不知道为啥这样做，all-to-all 的实现中一样会 pad 到固定大小）。