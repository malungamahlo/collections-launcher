const SAFE_LINK = /^(https?:|mailto:)/i
const SAFE_IMAGE = /^(blob:|data:image\/)/i

/**
 * Makes a drawn document safe to leave on screen: it is untrusted, and the
 * renderer turns some of it into live HTML. Links keep only web and mail
 * addresses (and anchors within the document), and open in a new tab;
 * pictures may only come from the document itself; anything that could load
 * or run something — frames, objects, scripts, forms — is removed.
 */
export function secureRenderedDocument(root: ParentNode): void {
  for (const element of Array.from(
    root.querySelectorAll('script, iframe, frame, object, embed, form, link, meta, base'),
  )) {
    element.remove()
  }

  for (const link of Array.from(root.querySelectorAll('a[href]'))) {
    const href = link.getAttribute('href') ?? ''

    if (href.startsWith('#')) {
      continue
    }

    if (SAFE_LINK.test(href)) {
      link.setAttribute('target', '_blank')
      link.setAttribute('rel', 'noopener noreferrer')
    } else {
      link.removeAttribute('href')
    }
  }

  for (const image of Array.from(root.querySelectorAll('img'))) {
    if (!SAFE_IMAGE.test(image.getAttribute('src') ?? '')) {
      image.remove()
    }
  }
}
