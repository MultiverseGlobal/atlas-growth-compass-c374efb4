// Content script to extract clean text from profiles
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extract_profile") {
    try {
      // Remove noisy elements like scripts, style blocks, nav, headers, and footer
      const bodyClone = document.body.cloneNode(true);
      
      const elementsToRemove = bodyClone.querySelectorAll('script, style, iframe, nav, header, footer, noscript');
      elementsToRemove.forEach(el => el.remove());

      const rawText = bodyClone.innerText || bodyClone.textContent || "";
      
      // Clean up whitespace
      const cleanText = rawText
        .replace(/\s+/g, " ")
        .replace(/\n+/g, "\n")
        .trim();

      sendResponse({
        success: true,
        text: cleanText.slice(0, 150000), // Safety limit for AI contexts
        url: window.location.href,
        title: document.title
      });
    } catch (err) {
      sendResponse({
        success: false,
        error: err.message
      });
    }
  }
  return true;
});
