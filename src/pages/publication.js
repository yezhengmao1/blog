import React from 'react';
import Layout from '@theme/Layout';

import styles from '../css/styles.module.css';

export default function Publication() {
    return (
        <Layout title="Publications">
            <div className={styles.post}>
                <ul>
                    <hr className={styles.pub_years}></hr>
                    <span className={styles.pub_span}>2025</span>
                    <hr className={styles.pub_years}></hr>

                    <li className={styles.publications}>
                        <b>mLoRA: Fine-Tuning LoRA Adapters via Highly-Efficient Pipeline Parallelism in Multiple GPUs</b>
                        <br></br>
                        <strong>Zhengmao Ye</strong>, Dengchun Li, Zetao Hu, Tingfen Lan, Sha Jian, Sicong Zheng, Lei Duan, Jie Zuo, Hui Lu, Yuanchun Zhou, Mingjie Tang
                        <br></br>
                        under revision <i>Proceedings of Very Large Data Bases Conference (VLDB), 2025.</i>
                    </li>

                    <li className={styles.publications}>
                        <b>Diffusion Counterfactual-Based Anomaly Detection in Class-Imbalanced Data</b>
                        <br></br>
                        Xinyun Shen, Min Li, <strong>Zhengmao Ye</strong>, Zhenyang Yu, Lei Duan
                        <br></br>
                        under rebuttal <i>IEEE International Conference on Acoustics, Speech, and Signal Processing (ICASSP), 2025.</i>
                    </li>

                    <hr className={styles.pub_years}></hr>
                    <span className={styles.pub_span}>2024</span>
                    <hr className={styles.pub_years}></hr>

                    <li className={styles.publications}>
                        <b>MixLoRA: Enhancing Large Language Models Fine-Tuning with LoRA-based Mixture of Experts</b>
                        <br></br>
                        Dengchun Li, Yingzi Ma, Naizheng Wang, <strong>Zhengmao Ye</strong>, Zhiyuan Cheng, Yinghao Tang, Yan Zhang, Lei Duan, Jie Zuo, Cal Yang, Mingjie Tang
                        <br></br>
                        arXiv preprint arXiv:2404.15159, 2024
                    </li>
                </ul>
            </div>

        </Layout>
    );
}