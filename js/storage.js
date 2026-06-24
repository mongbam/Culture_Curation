/**
 * storage.js - Manages localStorage persistence and calculations
 */

const STORAGE_KEY = 'culture_curator_saved_exhibitions';

/**
 * Get saved exhibition IDs/objects from localStorage
 * @returns {Array} List of saved exhibition objects
 */
function getSavedExhibitions() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load saved exhibitions from localStorage:', error);
    return [];
  }
}

/**
 * Save an exhibition to localStorage
 * @param {Object} exhibition 
 * @returns {Array} Updated list of saved exhibitions
 */
function saveExhibition(exhibition) {
  const saved = getSavedExhibitions();
  if (!saved.some(item => item.id === exhibition.id)) {
    saved.push(exhibition);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }
  return saved;
}

/**
 * Remove an exhibition from localStorage
 * @param {string} id 
 * @returns {Array} Updated list of saved exhibitions
 */
function removeExhibition(id) {
  let saved = getSavedExhibitions();
  saved = saved.filter(item => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  return saved;
}

/**
 * Clear all saved exhibitions
 */
function clearSavedExhibitions() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Utility to calculate the upcoming Saturday and Sunday dates of the current week
 * @returns {Object} { start: Date (Saturday), end: Date (Sunday) }
 */
function getThisWeekendRange() {
  const today = new Date();
  const day = today.getDay(); // 0 (Sunday) to 6 (Saturday)
  
  // Calculate difference to upcoming Saturday
  // Monday(1) -> 5 days, Friday(5) -> 1 day, Saturday(6) -> 0 days, Sunday(0) -> -1 day (yesterday)
  const diffToSaturday = 6 - (day === 0 ? 7 : day);
  
  const sat = new Date(today);
  sat.setDate(today.getDate() + diffToSaturday);
  sat.setHours(0, 0, 0, 0);
  
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  sun.setHours(23, 59, 59, 999);
  
  return { start: sat, end: sun };
}

/**
 * Checks if an exhibition is running during this weekend
 * @param {Object} exhibition 
 * @returns {boolean}
 */
function isExhibitionOnThisWeekend(exhibition) {
  try {
    const { start: sat, end: sun } = getThisWeekendRange();
    const exStart = new Date(exhibition.startDate);
    const exEnd = new Date(exhibition.endDate);
    exStart.setHours(0, 0, 0, 0);
    exEnd.setHours(23, 59, 59, 999);
    
    return exStart <= sun && exEnd >= sat;
  } catch (e) {
    return false;
  }
}

/**
 * Parse cost information from exhibition record
 * @param {Object} ex 
 * @returns {Object} { amount: number, label: string, isExact: boolean, priceType: string }
 */
function parseExhibitionCost(ex) {
  if (ex.priceType === 'free' || !ex.priceType) {
    return { amount: 0, label: '무료', isExact: true, priceType: 'free' };
  }
  if (ex.priceType === 'discount') {
    return { amount: 0, label: '할인 적용 (현장 확인)', isExact: false, priceType: 'discount' };
  }
  if (ex.priceType === 'paid') {
    // Try to extract digits from priceText
    const cleaned = (ex.priceText || '').replace(/,/g, '');
    const match = cleaned.match(/\d+/);
    if (match) {
      const amount = parseInt(match[0], 10);
      return { amount, label: `${amount.toLocaleString()}원`, isExact: true, priceType: 'paid' };
    }
    return { amount: 0, label: ex.priceText || '유료 (확인 필요)', isExact: false, priceType: 'paid' };
  }
  return { amount: 0, label: ex.priceText || '정보 확인 필요', isExact: false, priceType: 'unknown' };
}

/**
 * Calculates calendar statistics for a list of exhibitions
 * @param {Array} exhibitions 
 * @returns {Object} Stats summary
 */
function calculateCalendarStats(exhibitions) {
  let totalCost = 0;
  let hasUnresolvedCosts = false;
  let freeCount = 0;
  let discountCount = 0;
  let weekendCount = 0;

  exhibitions.forEach(ex => {
    const costInfo = parseExhibitionCost(ex);
    
    if (costInfo.priceType === 'free') {
      freeCount++;
    } else if (costInfo.priceType === 'discount') {
      discountCount++;
      hasUnresolvedCosts = true;
    } else {
      if (costInfo.isExact) {
        totalCost += costInfo.amount;
      } else {
        hasUnresolvedCosts = true;
      }
    }

    if (isExhibitionOnThisWeekend(ex)) {
      weekendCount++;
    }
  });

  return {
    totalCost,
    hasUnresolvedCosts,
    freeCount,
    discountCount,
    weekendCount,
    totalCount: exhibitions.length
  };
}

// Export functions to window object so other modules can use them
window.StorageModule = {
  getSavedExhibitions,
  saveExhibition,
  removeExhibition,
  clearSavedExhibitions,
  getThisWeekendRange,
  isExhibitionOnThisWeekend,
  parseExhibitionCost,
  calculateCalendarStats
};
