// Environment selection (PRD §10.2, D-37). Both URLs and publishable keys are public by design.
// The service_role key must never appear here or anywhere in the repo.

const ENVIRONMENTS = {
  production: {
    name: 'production',
    url: 'https://vnqgxopexirycynuybyc.supabase.co',
    key: 'sb_publishable_7UKp2chrOS99hEEfICCqUQ_eyr-_cef',
  },
  staging: {
    name: 'staging',
    url: 'https://pwhrcilahaupsbpjljmc.supabase.co',
    key: 'sb_publishable_4ZffgJuH8AGTlv-xQajmug_ychSdtFM',
  },
};

// TEMPORARY DEVIATION from PRD §10.2 (recorded in PRD v3.6, open item O-10): the production
// hostname is not known yet, so the hosts below are treated as staging and everything else uses
// production. Once the production domain exists, replace this with a PRODUCTION_HOSTS allow-list.
function isStagingHost(hostname) {
  return (
    hostname === '' ||                       // file:// preview
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.localhost') ||
    hostname.includes('--')                  // Netlify deploy-preview / branch-deploy hosts
  );
}

const hostname = (typeof location !== 'undefined' && location.hostname) || '';
export const ENV = isStagingHost(hostname) ? ENVIRONMENTS.staging : ENVIRONMENTS.production;
export const IS_PRODUCTION = ENV.name === 'production';

export const SUPABASE_URL = ENV.url;
export const SUPABASE_ANON_KEY = ENV.key;

// Client storage (PRD §10.4). No PINs, codes or data are ever written to localStorage.
export const TEACHER_TOKEN_KEY = 'mahad_teacher_token';
export const COURSE_KEY = 'mahad_course_id';
export const LEGACY_TEACHER_FLAG_KEY = 'mahad_teacher_unlocked';   // removed on load (v3 had a bare flag)

export const REALTIME_DEBOUNCE_MS = 500;
export const PAGE_SIZE = 1000;   // PostgREST default max rows per request
export const EXAM_AUTOSAVE_MS = 1500;
