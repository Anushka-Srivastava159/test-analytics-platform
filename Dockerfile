# Pin the image tag to the SAME version as @playwright/test in package.json.
# If they drift, the image ships browsers the test runner doesn't recognise.
FROM mcr.microsoft.com/playwright:v1.62.1-noble

WORKDIR /app

# Copy manifests first and install separately from the source copy. Docker caches
# layers: as long as package*.json is unchanged, edits to your tests reuse the
# cached npm ci layer instead of reinstalling on every build.
COPY package.json package-lock.json ./
RUN npm ci

# Now the rest of the project.
COPY . .

# playwright.config.ts keys retries, forbidOnly and the ci metadata flag off this.
# Without it a container run records ci:false and zero retries, so its rows aren't
# comparable with the Actions rows the dashboard aggregates alongside them.
ENV CI=true

CMD ["npx", "playwright", "test"]