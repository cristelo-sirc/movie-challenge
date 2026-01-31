import re

path = 'data/movies.js'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Extract title and rating
# Pattern: "title": "...", ... "vote_average": 8.2
pattern = r'"title": "(.*?)".*?"vote_average": ([0-9.]+)'
matches = re.findall(pattern, content, re.DOTALL)

# Sort by rating ascending
low_rated = [(t, float(r)) for t, r in matches if float(r) < 6.0]
low_rated.sort(key=lambda x: x[1])

print(f"\nSample of movies < 6.0 ({len(low_rated)} total):")
for title, rating in low_rated:
    print(f"{rating}: {title}")

