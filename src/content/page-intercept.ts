// Riposte Page Intercept — runs in MAIN world to intercept fetch calls
// This script has access to the page's real window.fetch
// Uses window.postMessage to communicate with the isolated-world content script

const originalFetch = window.fetch

window.fetch = async function (...args: Parameters<typeof fetch>) {
  const [input, init] = args

  let url = ''
  if (typeof input === 'string') {
    url = input
  } else if (input instanceof URL) {
    url = input.href
  } else if (input instanceof Request) {
    url = input.url
  }

  // Debug: log all GraphQL calls so we can see X's actual endpoint names
  if (url.includes('/graphql/') || url.includes('/i/api/')) {
    const endpoint = url.split('/').pop()?.split('?')[0] || url
    console.log('[Riposte DEBUG] Fetch:', init?.method || 'GET', endpoint, url.slice(0, 120))
  }

  // Match reply creation — check multiple possible endpoint patterns
  const isCreateTweet =
    url.includes('CreateTweet') ||
    url.includes('create_tweet') ||
    url.includes('CreateReply')

  if (isCreateTweet && init?.method?.toUpperCase() === 'POST') {
    console.log('[Riposte DEBUG] CreateTweet detected! Parsing body...')
    try {
      let bodyText = ''
      if (typeof init.body === 'string') {
        bodyText = init.body
      } else if (init.body instanceof Blob) {
        bodyText = await init.body.text()
      } else if (init.body instanceof ArrayBuffer) {
        bodyText = new TextDecoder().decode(init.body)
      }

      if (bodyText) {
        const body = JSON.parse(bodyText)
        const replyTweetId = body?.variables?.reply?.in_reply_to_tweet_id

        console.log('[Riposte DEBUG] Body parsed. reply_to_id:', replyTweetId)

        if (replyTweetId) {
          const data = extractReplyContext()
          const replyText = body?.variables?.tweet_text || ''
          console.log('[Riposte DEBUG] Reply context:', data)

          // Use postMessage instead of CustomEvent — data crosses world boundary via structured clone
          window.postMessage({
            type: '__riposte_reply__',
            repliedToUsername: data.username,
            repliedToDisplayName: data.displayName,
            repliedToTweetUrl: data.tweetUrl,
            replyText,
            originalTweetText: data.originalTweetText,
            timestamp: Date.now(),
          }, '*')
        }
      }
    } catch (e) {
      console.log('[Riposte DEBUG] Parse error:', e)
    }
  }

  return originalFetch.apply(this, args)
}

// Also intercept XMLHttpRequest as a fallback
const originalXHROpen = XMLHttpRequest.prototype.open
const originalXHRSend = XMLHttpRequest.prototype.send

XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: unknown[]) {
  (this as XMLHttpRequest & { _riposteUrl: string; _riposteMethod: string })._riposteUrl = url.toString()
  ;(this as XMLHttpRequest & { _riposteMethod: string })._riposteMethod = method
  return originalXHROpen.apply(this, [method, url, ...rest] as Parameters<typeof originalXHROpen>)
}

XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
  const xhr = this as XMLHttpRequest & { _riposteUrl: string; _riposteMethod: string }
  const url = xhr._riposteUrl || ''

  if (url.includes('/graphql/') || url.includes('/i/api/')) {
    const endpoint = url.split('/').pop()?.split('?')[0] || url
    console.log('[Riposte DEBUG] XHR:', xhr._riposteMethod, endpoint)
  }

  const isCreateTweet =
    url.includes('CreateTweet') ||
    url.includes('create_tweet') ||
    url.includes('CreateReply')

  if (isCreateTweet && xhr._riposteMethod?.toUpperCase() === 'POST' && typeof body === 'string') {
    try {
      const parsed = JSON.parse(body)
      const replyTweetId = parsed?.variables?.reply?.in_reply_to_tweet_id
      if (replyTweetId) {
        const data = extractReplyContext()
        const replyText = parsed?.variables?.tweet_text || ''
        window.postMessage({
          type: '__riposte_reply__',
          repliedToUsername: data.username,
          repliedToDisplayName: data.displayName,
          repliedToTweetUrl: data.tweetUrl,
          replyText,
          originalTweetText: data.originalTweetText,
          timestamp: Date.now(),
        }, '*')
      }
    } catch { /* ignore */ }
  }

  return originalXHRSend.apply(this, [body])
}

function extractOriginalTweetText(): string {
  // Try to get the original tweet text from the tweet being replied to
  // In a reply dialog, the original tweet is shown above the reply box
  const dialog = document.querySelector('[role="dialog"]')
  if (dialog) {
    const tweetTexts = dialog.querySelectorAll('[data-testid="tweetText"]')
    // First tweetText in the dialog is the original tweet
    if (tweetTexts.length > 0) {
      return tweetTexts[0].textContent || ''
    }
  }
  // On a tweet's page, the main tweet text
  const mainTweet = document.querySelector('article [data-testid="tweetText"]')
  if (mainTweet) {
    return mainTweet.textContent || ''
  }
  return ''
}

function extractReplyContext() {
  const pageUrl = window.location.href
  const match = pageUrl.match(/x\.com\/([^/]+)\/status\/(\d+)/)
  const originalTweetText = extractOriginalTweetText()

  if (match) {
    const username = match[1]
    const el = document.querySelector(
      `[data-testid="User-Name"] a[href="/${username}"] span`
    )
    return {
      username,
      displayName: el?.textContent || username,
      tweetUrl: `https://x.com/${username}/status/${match[2]}`,
      originalTweetText,
    }
  }

  // Fallback: try to get info from reply dialog
  const dialog = document.querySelector('[role="dialog"]')
  if (dialog) {
    const links = dialog.querySelectorAll('a[href^="/"][role="link"]')
    for (const link of links) {
      const href = link.getAttribute('href') || ''
      const u = href.slice(1)
      if (u && !u.includes('/')) {
        return {
          username: u,
          displayName: link.textContent || u,
          tweetUrl: pageUrl,
          originalTweetText,
        }
      }
    }
  }

  return { username: 'unknown', displayName: 'Unknown', tweetUrl: pageUrl, originalTweetText }
}

console.log('[Riposte] Page intercept loaded — fetch & XHR patched')
