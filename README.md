# FtsEditor

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 14.2.13.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Appwrite Sites

This repo is ready to deploy to Appwrite Sites as a static Angular application.

Use these settings when creating or updating the site in Appwrite:

- Framework: `Other` or `Angular` if available in your Appwrite UI
- Install command: `npm install`
- Build command: `npm run build:prod`
- Output directory: `dist/angular`

If the site should behave as a single-page application, add a rewrite in Appwrite Sites so client-side routes fall back to `index.html`.

Typical manual deploy flow:

1. Push this repo to a Git provider connected to Appwrite, or upload the built `dist/angular` output.
2. In Appwrite Sites, create a new site.
3. Set the install/build/output values listed above.
4. Deploy the latest commit or uploaded artifact.

Appwrite environment values used by the frontend are defined in:

- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.
