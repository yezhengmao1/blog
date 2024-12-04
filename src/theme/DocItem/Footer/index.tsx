import React from 'react';
import Footer from '@theme-original/DocItem/Footer';
import type FooterType from '@theme/DocItem/Footer';
import type { WrapperProps } from '@docusaurus/types';

import { useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import 'artalk/Artalk.css'
import Artalk from 'artalk';

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

  return (
    <>
      <Footer {...props} />
      <div ref={handleContainerInit}></div>
    </>
  );
}
