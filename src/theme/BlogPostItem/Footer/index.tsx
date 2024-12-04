import React from 'react';
import Footer from '@theme-original/BlogPostItem/Footer';
import type FooterType from '@theme/BlogPostItem/Footer';
import type { WrapperProps } from '@docusaurus/types';

import { useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import 'artalk/Artalk.css'
import Artalk from 'artalk';

import { hashcode } from '../../utils';

type Props = WrapperProps<typeof FooterType>;

export default function FooterWrapper(props: Props): JSX.Element {
  const { pathname } = useLocation()
  const artalk = useRef<Artalk>()

  const handleContainerInit = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) {
        return
      }
      if (artalk.current) {
        artalk.current.destroy()
        artalk.current = undefined
      }
      artalk.current = Artalk.init({
        el: node,
        pageKey: pathname,
        pageTitle: document.title,
        server: 'https://yezhem.com:23366',
        site: 'ZhengMao.Ye',
      })
    },
    [pathname],
  )

  const id = "zhengmao.ye.doc" + hashcode(pathname)
  const countpath = "https://count.getloli.com/@" + id + "?name=" + id + "&theme=morden-num&padding=7&offset=0&align=top&scale=1&pixelated=1&darkmode=0"

  return (
    <>
      <Footer {...props} />
      <hr style={{ marginTop: '70px' }}></hr>
      <div ref={handleContainerInit} style={{ marginTop: '70px' }}></div >
      <div style={{ float: 'right' }}>
        <strong >Page views: </strong>
        <img src={countpath} style={{ width: '20%' }} />
      </div>
    </>
  );
}
