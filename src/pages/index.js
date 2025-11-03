import React from 'react';
import Layout from '@theme/Layout';

import styles from '../css/styles.module.css';

export default function Index() {
    return (
        <Layout title="About ZhengMao.Ye">
            <div className={styles.post}>
                <article>

                    <div className={styles.profile}>
                        <img src='https://yezhem.oss-cn-chengdu.aliyuncs.com/blog_img/me.png' className={styles.my_avatar}></img>
                        <div>
                            <h2>Zhengmao Ye</h2>
                            <p>
                                email: <a href='mailto:yezhengmaolove@gmail.com'>yezhengmaolove@gmail.com</a>
                            </p>
                        </div>
                    </div>

                    <p>
                        I am a master student in computer science at
                        <a href='https://ids-lab-asia.github.io/'> IDs Lab </a>
                        of Sichuan University under Prof.
                        <a href='https://merlintang.github.io/index.html'>Mingjie Tang.</a>
                    </p>

                    <p>
                        Before joining Sichuan University, I earned my bachelor’s degree
                        from Southwest Jiaotong University
                        and worked as a member of the technical staff at Huawei and SenseTime.
                    </p>

                    <p>
                        Currently, I am working on Large Language Model system.
                        For example, optimizing parallel strategies for efficient fine-tuning of Large Language Models (LLMs).
                    </p>

                    <p>
                        I am open to other opportunities and new research,
                        so please feel free to reach me at my email.
                    </p>

                    <h2>Selected Publications</h2>

                    <ul>
                        <li className={styles.publications}>
                            <b>mLoRA: Fine-Tuning LoRA Adapters via Highly-Efficient Pipeline Parallelism in Multiple GPUs</b>
                            <br></br>
                            <strong>Zhengmao Ye</strong>, Dengchun Li, Zetao Hu, Tingfen Lan, Sha Jian, Sicong Zheng, Lei Duan, Jie Zuo, Hui Lu, Yuanchun Zhou, Mingjie Tang
                            <br></br>
                            in <i>Proceedings of Very Large Data Bases Conference (VLDB), 2025.</i>
                        </li>
                    </ul>
                </article>

            </div >
        </Layout >
    );
}