
import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";

const originalFetch = global.fetch;
global.fetch = async (url, options) => {
  console.log("Firebase SDK is fetching:", url);
  return originalFetch(url, options);
};

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyB3R7ar7W3BXIKmcGo0Zc4U5oOUl4mg44c",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "lichhoc-e15b6",
  storageBucket: "lichhoc-e15b6.appspot.com",
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

async function test() {
  try {
    const storageRef = ref(storage, 'schedules/test_node_sdk.txt');
    // Using simple base64 string
    const b64 = Buffer.from("Hello from Node JS SDK!").toString('base64');
    const dataUrl = `data:text/plain;base64,${b64}`;
    
    console.log("Uploading...");
    const snapshot = await uploadString(storageRef, dataUrl, 'data_url');
    console.log("Upload successful!");
    
    const url = await getDownloadURL(snapshot.ref);
    console.log("URL:", url);
  } catch (error) {
    console.error("Error:", error);
  }
}

test();
