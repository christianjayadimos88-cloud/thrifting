const locations = {
  'Metro Manila': {
    region: 'National Capital Region',
    cities: {
      Manila: ['Barangay 1', 'Barangay 2', 'Barangay 3'],
      Quezon: ['Commonwealth', 'Batasan Hills', 'Holy Spirit'],
      Makati: ['Poblacion', 'Bel-Air', 'San Lorenzo'],
      Pasig: ['Bagong Ilog', 'Kapitolyo', 'San Antonio']
    }
  },
  Cebu: {
    region: 'Central Visayas',
    cities: { Cebu: ['Apas', 'Lahug', 'Mabolo'], Mandaue: ['Banilad', 'Cabancalan', 'Tipolo'] }
  },
  'Davao del Sur': {
    region: 'Davao Region',
    cities: { Davao: ['Buhangin', 'Matina', 'Poblacion'] }
  },
  Laguna: {
    region: 'CALABARZON',
    cities: { 'Santa Rosa': ['Balibago', 'Canlalay', 'Tagapo'], Calamba: ['Canlubang', 'Halang', 'Real'] }
  }
};

module.exports = locations;
