/**
 * filters.js - Filters, searches, and sorts exhibition lists
 */

/**
 * Checks if an exhibition overlaps with the current calendar month
 * @param {Object} exhibition 
 * @returns {boolean}
 */
function isExhibitionInThisMonth(exhibition) {
  try {
    const today = new Date();
    // First day of current month: e.g. 2026-06-01
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
    // Last day of current month: e.g. 2026-06-30
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const exStart = new Date(exhibition.startDate);
    const exEnd = new Date(exhibition.endDate);
    
    return exStart <= lastDay && exEnd >= firstDay;
  } catch (e) {
    return true;
  }
}

/**
 * Checks if an exhibition is currently ongoing (active today)
 * @param {Object} exhibition 
 * @returns {boolean}
 */
function isExhibitionOngoing(exhibition) {
  try {
    const today = new Date();
    const exStart = new Date(exhibition.startDate);
    const exEnd = new Date(exhibition.endDate);
    
    // Normalize times
    const compareDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0);
    const startCompare = new Date(exStart.getFullYear(), exStart.getMonth(), exStart.getDate(), 0, 0, 0);
    const endCompare = new Date(exEnd.getFullYear(), exEnd.getMonth(), exEnd.getDate(), 23, 59, 59);
    
    return startCompare <= compareDate && endCompare >= compareDate;
  } catch (e) {
    return true;
  }
}

/**
 * Filters the exhibitions list based on current filters state
 * @param {Array} exhibitions 
 * @param {Object} stateFilters 
 * @param {string} selectedRegion 
 * @param {string} searchQuery 
 * @returns {Array} Filtered list
 */
function filterExhibitions(exhibitions, stateFilters, selectedRegion, searchQuery) {
  return exhibitions.filter(ex => {
    // 1. Region filter
    if (selectedRegion && selectedRegion !== '전체') {
      if (ex.region !== selectedRegion) return false;
    }

    // 2. Search query (matches title, venue, region, district, or address)
    if (searchQuery && searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = (ex.title || '').toLowerCase().includes(q);
      const matchVenue = (ex.venue || '').toLowerCase().includes(q);
      const matchRegion = (ex.region || '').toLowerCase().includes(q);
      const matchDistrict = (ex.district || '').toLowerCase().includes(q);
      const matchAddress = (ex.address || '').toLowerCase().includes(q);
      
      if (!matchTitle && !matchVenue && !matchRegion && !matchDistrict && !matchAddress) {
        return false;
      }
    }

    // 3. Free only filter
    if (stateFilters.freeOnly) {
      if (ex.priceType !== 'free') return false;
    }

    // 4. Culture day filter
    if (stateFilters.cultureDayOnly) {
      if (!ex.isCultureDay) return false;
    }

    // 5. This Weekend only filter
    if (stateFilters.thisWeekendOnly) {
      const isWeekend = window.StorageModule ? window.StorageModule.isExhibitionOnThisWeekend(ex) : false;
      if (!isWeekend) return false;
    }

    // 6. This Month only filter
    if (stateFilters.thisMonthOnly) {
      if (!isExhibitionInThisMonth(ex)) return false;
    }

    // 7. Ongoing only filter
    if (stateFilters.ongoingOnly) {
      if (!isExhibitionOngoing(ex)) return false;
    }

    return true;
  });
}

/**
 * Sorts the filtered exhibitions list
 * @param {Array} exhibitions 
 * @param {string} sortBy 
 * @returns {Array} Sorted list
 */
function sortExhibitions(exhibitions, sortBy) {
  const list = [...exhibitions];

  return list.sort((a, b) => {
    switch (sortBy) {
      case 'endingSoon':
        // Sort by end date ascending (earliest end date first)
        const dateA = new Date(a.endDate || '9999-12-31');
        const dateB = new Date(b.endDate || '9999-12-31');
        return dateA - dateB;

      case 'freeFirst':
        // Sort by priceType === 'free' first
        const priceA = a.priceType === 'free' ? 0 : 1;
        const priceB = b.priceType === 'free' ? 0 : 1;
        if (priceA !== priceB) return priceA - priceB;
        // fallback to ending soon
        return new Date(a.endDate || '9999-12-31') - new Date(b.endDate || '9999-12-31');

      case 'cultureDayFirst':
        // Sort by isCultureDay === true first
        const cdA = a.isCultureDay ? 0 : 1;
        const cdB = b.isCultureDay ? 0 : 1;
        if (cdA !== cdB) return cdA - cdB;
        // fallback to ending soon
        return new Date(a.endDate || '9999-12-31') - new Date(b.endDate || '9999-12-31');

      case 'region':
        // Sort by region name alphabetically
        return (a.region || '').localeCompare(b.region || '', 'ko');

      case 'venue':
        // Sort by venue name alphabetically
        return (a.venue || '').localeCompare(b.venue || '', 'ko');

      default:
        return 0;
    }
  });
}

// Export functions to window
window.FiltersModule = {
  filterExhibitions,
  sortExhibitions,
  isExhibitionInThisMonth,
  isExhibitionOngoing
};
