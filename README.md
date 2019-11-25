# OpenTransit's Metrics MVP

Welcome to OpenTransit! We're passionate about using open data to improve
public transit systems around the world, starting with San Francisco.

This app uses historical transit data to help riders understand
the quality of SF Muni bus and subway lines. [Check out the app!](http://muni.opentransit.city/)

If you're visiting this repo and looking to contribute, [check out our onboarding doc!](http://bit.ly/opentransit-onboarding)

## Building the app

To start, you'll need to get Docker. Install [Docker Desktop](https://www.docker.com/products/docker-desktop) or another Docker distribution for your platform.

Build and run the Docker containers:

```sh
docker-compose up
```

This will run the React frontend in development mode at http://localhost:3000,
and the Flask backend in development mode at http://localhost:5000.

Your local directory will be shared within the Docker container at `/app`.
When you edit files in your local directory, the React and Flask containers should automatically update with the new code.

To start a shell within the Flask Docker container, run `./docker-shell.sh` (Linux/Mac) or `docker-shell` (Windows).

You can run command line scripts like `backend/compute_arrivals.py` and `backend/headways.py` from the shell in the Docker container.

If you need to install some new dependencies in the Docker images, you can rebuild them via `docker-compose build`.

## Configuring the displayed transit agency

By default, the app shows statistics for San Francisco Muni. You can configure the transit agency displayed in the web app by setting the OPENTRANSIT_AGENCY_IDS environment variable.

Other available agency IDs include:
- `trimet` (TriMet in Portland, Oregon)
- `portland-sc` (Portland Streetcar)

To set this environment variable in development when using Docker, create a file named docker-compose.override.yml file in the root directory of this repository, like so:

```
version: "3.7"
services:
  flask-dev:
    environment:
      OPENTRANSIT_AGENCY_IDS: trimet
```

After changing docker-compose.override.yml, you will need to re-run `docker-compose up` for the changes to take effect.

## Contributing

Make sure you've been added to the trynmaps organization on GitHub.
[Join the Code for SF Slack](http://c4sf.me/slack) and join the #opentransit channel,
then you'll see a guide to get in.

To get started, see the Issues page. You may want to [identify good first issues](https://github.com/trynmaps/metrics-mvp/labels/Good%20First%20Issue).

### Deploying to Heroku

When you make a Pull Request, we would suggest you deploy your branch to Heroku so that other
team members can try out your feature.

First, create an account  at [heroku.com](https://heroku.com) and
[create an app](https://dashboard.heroku.com/apps). Follow the instructions to deploy
using Heroku Git with an existing Git repository.

The first time you deploy to Heroku, you'll need to tell it to build Docker
containers using heroku.yml:

```sh
heroku stack:set container
```

You then need to set up a remote called `heroku`. Then run this to deploy your local branch:

```sh
git push heroku local-branch-name:master
```

Then copy the link to this app and paste it in the PR.

## How Deployment Works

Once a PR is merged into master, Google Cloud Build  will automatically build
the latest code and deploy it to a cluster on Google Kubernetes Engine (GKE).
The build steps are defined in `cloudbuild.yaml`.

## Our tech stack

### Overall

- **Docker** - to ensure a consistent environment across machines.
- **Docker Compose** - to run multiple containers at once.

### Frontend

- **NPM** - for package management. We explicitly decided to *not* use Yarn, because both
package managers offer similar performance, we were already using NPM for backend
package management, and the Yarn roadmap did not offer compelling
improvements going forward.
- **React** - Selected for popularity, simple view, and speedy virutal DOM. Code lives in the `/frontend` directory.  It was built using
[Create React App](https://facebook.github.io/create-react-app/docs/folder-structure).
- **Material UI** - which we use over Bootstrap since MUI doesn't rely on jQuery. It has a
popular React framework and looks great on mobile.
- **Redux** - for state management and to simplify our application and component interaction.
- **Redux Thunk** - as middleware for Redux.
- **React Hooks** - to manage interactions with state management.
- **Functional Components** - We migrated away from ES6 React Components and toward React
[Functional Components](https://reactjs.org/docs/components-and-props.html) due to the simpler component logic and the ability to use React Hooks that Functional Components offer.
- **ESLint** - Linting set in the format of AirBNB Style.
- **Prettier** - Code formatter to maintain standard code format for the frontend code.
- **Husky** - Pre-commit hook to trigger Prettier auto formatting before pushing to Github.

### Backend

- **Flask** - because our data science work was already done in iPython and using
Python for the backend would ease the migration from experimentation to production.

## Notes for developers

### Python

If you ever need to use a new pip library, make sure you run `pip freeze > requirements.txt`
so other contributors have the latest versions of required packages.

### Windows

If you're developing within Docker on Windows, by default, React does not automatically recompile the frontend code when you make changes.
In order to allow React to automatically recompile the frontend code within the Docker container when you edit files shared from your
Windows host computer, you can create a `docker-compose.override.yml` to enable CHOKIDAR_USEPOLLING like this:

```yml
version: "3.7"
services:
  react-dev:
    environment:
      CHOKIDAR_USEPOLLING: "true"
      CHOKIDAR_INTERVAL: "2500"
```

This setting is not in the main docker-compose.yml file because CHOKIDAR_USEPOLLING causes high CPU/battery usage for developers using Mac OS X,
and CHOKIDAR_USEPOLLING is not necessary on Mac OS X to automatically recompile the frontend code when it changes.

### Advanced Concepts

Please see [ADVANCED_DEV.md](docs/ADVANCED_DEV.md) for advanced information like computing arrival times and
deploying to AWS.

See [agencies.md](docs/agencies.md) for configuring for different agencies, and how the front end gets the
configuration information.  Important for testing with other devices against your dev machine.

