import React from 'react';
import Layout from '@theme/Layout';

import styles from '../css/styles.module.css';

export default function Project() {
    return (
        <Layout title="Projects">
            <div className={styles.post}>
                <ul>

                    <li className={styles.publications}>
                        <span style={{ fontSize: '16px', lineHeight: 1, marginRight: '5px' }}>
                            <svg role="img" width="1em" height="1em" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>GitHub</title><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
                        </span>

                        <b><a href='https://github.com/TUDB-Labs/mLoRA'>TUDB-Labs/mLoRA</a></b>
                        <br></br>
                        An Efficient "Factory" to Build Multiple LoRA Adapters
                        <br></br>
                        <img src="https://img.shields.io/github/stars/TUDB-Labs/mLoRA" style={{ marginTop: '5px', marginRight: '20px' }}></img>
                        <img src="https://img.shields.io/github/forks/TUDB-Labs/mLoRA" style={{ marginTop: '5px' }}></img>
                    </li>

                    <li className={styles.publications}>
                        <span style={{ fontSize: '16px', lineHeight: 1, marginRight: '5px' }}>
                            <svg role="img" width="1em" height="1em" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>GitHub</title><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
                        </span>

                        <b><a href='https://github.com/yezhengmao1/TextPy'>yezhengmao1/TextPy</a></b>
                        <br></br>
                        TextPy: Collaborative Agent Workflow through Programming and Prompting
                        <br></br>
                        <img src="https://img.shields.io/github/stars/yezhengmao1/TextPy" style={{ marginTop: '5px', marginRight: '20px' }}></img>
                        <img src="https://img.shields.io/github/forks/yezhengmao1/TextPy" style={{ marginTop: '5px' }}></img>
                    </li>

                    <li className={styles.publications}>
                        <span style={{ fontSize: '16px', lineHeight: 1, marginRight: '5px' }}>
                            <svg role="img" width="1em" height="1em" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>GitHub</title><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
                        </span>

                        <b><a href='https://github.com/yezhengmao1/fabric-sample'>yezhengmao1/fabric-sample</a></b>
                        <br></br>
                        Hyperledger Fabric 1.4.4,Hyperledger Caliper 0.3.0 configuration - pbft/solo/multichannel
                        <br></br>
                        <img src="https://img.shields.io/github/stars/yezhengmao1/fabric-sample" style={{ marginTop: '5px', marginRight: '20px' }}></img>
                        <img src="https://img.shields.io/github/forks/yezhengmao1/fabric-sample" style={{ marginTop: '5px' }}></img>
                    </li>


                </ul>
            </div>
        </Layout>
    );
}