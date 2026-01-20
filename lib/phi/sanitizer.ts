/**
 * Sanitizes HTML content to prevent XSS attacks
 * Removes potentially dangerous tags and attributes
 */
export function sanitizeHtml(html: string): string {
  if (!html) return ''

  // Create a temporary DOM element to parse the HTML
  const temp = document.createElement('div')
  temp.innerHTML = html

  // Remove dangerous elements
  const dangerousElements = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button']
  dangerousElements.forEach(tag => {
    const elements = temp.querySelectorAll(tag)
    elements.forEach(el => el.remove())
  })

  // Remove dangerous attributes
  const dangerousAttributes = ['onload', 'onerror', 'onclick', 'onmouseover', 'onmouseout', 'onkeydown', 'onkeyup', 'onkeypress', 'onchange', 'onsubmit', 'onfocus', 'onblur', 'onselect', 'onreset']
  const allElements = temp.querySelectorAll('*')
  allElements.forEach(el => {
    dangerousAttributes.forEach(attr => {
      el.removeAttribute(attr)
    })
    // Remove javascript: URLs
    const href = el.getAttribute('href')
    if (href && href.toLowerCase().startsWith('javascript:')) {
      el.removeAttribute('href')
    }
  })

  return temp.innerHTML
}

/**
 * Sanitizes text content by escaping HTML entities
 */
export function sanitizeText(text: string): string {
  if (!text) return ''
  const map: Record<string, string> = {
    '&': '&',
    '<': '<',
    '>': '>',
    '"': '"',
    "'": '&#x27;',
    '/': '&#x2F;'
  }
  return text.replace(/[&<>"'/]/g, (m) => map[m])
}