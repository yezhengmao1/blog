# Megatron-LM 工作流

## 

pretrain: 预训练的入口
    1. 初始化 Megatron
        初始化分布式环境，torch distributed
    2. 初始化 Model, Optimizer, LR Schedule
    3. 获取数据集
    4. 训练