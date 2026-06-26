import os
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

import psycopg2
import psycopg2.extras


def get_connection():
    url = os.environ.get("DATABASE_URL", "")
    parsed = urlparse(url)
    params = {k: v[0] for k, v in parse_qs(parsed.query).items()}
    params.pop("pgbouncer", None)
    params.pop("connection_limit", None)
    clean = urlunparse(parsed._replace(query=urlencode(params)))
    return psycopg2.connect(clean)
