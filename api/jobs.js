export default async function handler(req, res) {
  try {
    const url = new URL(
      'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobs'
    );

    const allowedParams = ['was', 'wo', 'umkreis', 'size'];

    for (const param of allowedParams) {
      if (req.query[param]) {
        url.searchParams.set(param, req.query[param]);
      }
    }

    const response = await fetch(url, {
      headers: {
        'X-API-Key': 'jobboerse-jobsuche'
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
    console.error('BA API Fehler:', error);

    res.status(500).json({
      fehler: error.message
    });
  }
}
