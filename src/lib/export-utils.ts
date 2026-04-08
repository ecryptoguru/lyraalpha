/**
 * Format conversation messages as plain text
 */
export function formatConversationAsText(messages: Array<{ role: string; content: string }>): string {
  return messages
    .map(msg => {
      const role = msg.role === 'user' ? 'You' : 'Lyra';
      return `${role}:\n${msg.content}\n`;
    })
    .join('\n---\n\n');
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const result = document.execCommand('copy');
      document.body.removeChild(textArea);
      return result;
    }
  } catch {
    return false;
  }
}
