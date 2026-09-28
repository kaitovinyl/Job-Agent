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

    const data = await response.json();

    res.status(response.status).json(data);
  } catch (error) {
    console.error('BA API Fehler:', error);
    res.status(500).json({
      error: 'BA-Jobsuche konnte nicht erreicht werden.'
    });
  }
}
