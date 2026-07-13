export function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'NGN' || currency === 'KES' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function getProductEmoji(category: string) {
  const map: Record<string, string> = {
    Supplements: '💊',
    Wellness: '🌿',
    Nutrition: '🥗',
    Beauty: '✨',
    Kids: '🧒',
    Beverages: '🍵',
  };
  return map[category] ?? '📦';
}

const coverStyles: Record<string, { emoji: string; color: string }> = {
  'cover-green': { emoji: '🌿', color: '#1A5E3A' },
  'cover-summit': { emoji: '🎤', color: '#2D4A6F' },
  'cover-mobile': { emoji: '📱', color: '#C5A059' },
  'cover-comp': { emoji: '💰', color: '#0F4D2E' },
  'cover-warehouse': { emoji: '🏭', color: '#4A5568' },
  'cover-milestone': { emoji: '🎉', color: '#1A5E3A' },
  'cover-business': { emoji: '📈', color: '#1A5E3A' },
  'cover-habits': { emoji: '⭐', color: '#C5A059' },
  'cover-bonus': { emoji: '💎', color: '#0F4D2E' },
  'cover-science': { emoji: '🔬', color: '#2D7A52' },
  'cover-social': { emoji: '📣', color: '#4A6FA5' },
  'cover-onboard': { emoji: '🤝', color: '#A8843F' },
};

export function getCoverStyle(imageUrl?: string) {
  if (imageUrl && coverStyles[imageUrl]) return coverStyles[imageUrl];
  return { emoji: '📰', color: '#1A5E3A' };
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatOrderStatus(status: string) {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
