const bucket1 = "lichhoc-e15b6.firebasestorage.app";
const bucket2 = "lichhoc-e15b6.appspot.com";

async function test(bucket) {
  const encodedPath = encodeURIComponent('schedules/test.jpg');
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodedPath}`;
  console.log("Testing:", url);
  const res = await fetch(url, {
    method: 'POST',
    body: 'test'
  });
  console.log(bucket, res.status);
  const text = await res.text();
  console.log(text);
}

async function main() {
  await test(bucket1);
  await test(bucket2);
}
main();
