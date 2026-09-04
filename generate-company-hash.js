import crypto from 'crypto';

function makeUrl(company) {
  function hashString(string) {
    const m = crypto.createHash('sha256');
    m.update(string);
    m.update(Buffer.from('12ca4b05c51ea3528e3904ef7fedfaa5')); // add a salt
    return m.digest('hex');
  }

  const c = hashString(company);
  return `${c}.data.json`;
}

//console.log(makeUrl('Authenica Cohort 2'));
console.log(makeUrl('Authenica'));
