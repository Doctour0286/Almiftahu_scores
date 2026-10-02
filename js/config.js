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

// TEMPORARY DEVIATION from PRD §10.2 (recorded in PRD v3.6): the production hostname is not
// known yet, so we cannot say "production domain -> production, everything else -> staging"
// without risking pointing the live site at staging. Until it is known, the hosts below are
// treated as staging and everything else keeps using production, exactly as before.
// Once the production domain exists, replace this with a PRODUCTION_HOSTS allow-list.
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

export const DAY_COUNT = 10;
export const DAY_MAX = 10;
export const BONUS_UNIT_VALUE = 2;
export const MAX_TOTAL = 100;
export const TEACHER_SESSION_KEY = "mahad_teacher_unlocked";
