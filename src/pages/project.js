import React from 'react';
import Layout from '@theme/Layout';

import styles from '../css/styles.module.css';

export default function Project() {
    return (
        <Layout title="Projects">
            <div className={styles.post}>
                <ul>

                    <hr className={styles.pub_years}></hr>
                    <span className={styles.pub_span}>Repos</span>
                    <hr className={styles.pub_years}></hr>

                    <li className={styles.repos}>
                        <a href="https://github.com/TUDB-Labs/mLoRA">
                            <img width="400px" align="center" src="https://github-readme-stats.vercel.app/api/pin/?username=TUDB-Labs&repo=mLoRA" />
                        </a>
                    </li>

                    <li className={styles.repos}>
                        <a href="https://github.com/yezhengmao1/fabric-sample">
                            <img width="400px" align="center" src="https://github-readme-stats.vercel.app/api/pin/?username=yezhengmao1&repo=fabric-sample" />
                        </a>
                    </li>

                    <hr className={styles.pub_years}></hr>
                    <span className={styles.pub_span}>Stats</span>
                    <hr className={styles.pub_years}></hr>


                    <li className={styles.repos}>
                        <a href="https://github.com/yezhengmao1">
                            <img width="400px" align="center" src="https://github-readme-stats.vercel.app/api?username=yezhengmao1&count_private=true" />
                        </a>
                    </li>

                </ul>
            </div>
        </Layout>
    );
}