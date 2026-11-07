const locations = require('../../lib/locations');

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const province = locations[req.query.province];
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).json(province
    ? { region: province.region, cities: Object.keys(province.cities) }
    : { region: '', cities: [] });
};
