export default async function handler(req, res) {
  try {
    const url = new URL(
      'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs'
    );

    url.searchParams.set('angebotsart', '1');
    url.searchParams.set('page', '1');
    url.searchParams.set('size', '25');
    url.searchParams.set('pav', 'false');

    if (req.query.was) url.searchParams.set('was', req.query.was);
    if (req.query.wo) url.searchParams.set('wo', req.query.wo);
    if (req.query.umkreis) url.searchParams.set('umkreis', req.query.umkreis);

    const response = await fetch(url, {
      headers: {
        'X-API-Key': 'jobboerse-jobsuche',
        'Accept': 'application/json'
      }
    });

    const text = await response.text();

    if (!response.ok) {
      return res.status(500).json({
        baStatus: response.status,
        baAntwort: text
      });
    }

    res.status(200).send(text);

  } catch (error) {
    res.status(500).json({
      fehler: error.message
    });
  }
}
