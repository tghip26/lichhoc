const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");
const { getAuth, createUserWithEmailAndPassword } = require("firebase/auth");

const firebaseConfig = {
  apiKey: "AIzaSyB3R7ar7W3BXIKmcGo0Zc4U5oOUl4mg44c",
  authDomain: "lichhoc-e15b6.firebaseapp.com",
  projectId: "lichhoc-e15b6",
  storageBucket: "lichhoc-e15b6.firebasestorage.app",
  messagingSenderId: "111834925875",
  appId: "1:111834925875:web:520a7a566737f4b20f4c46"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function run() {
  console.log("Đang đọc danh sách tất cả tài khoản...");
  try {
    const email = "auth_check_" + Math.random().toString(36).substring(7) + "@example.com";
    const password = "password123";
    await createUserWithEmailAndPassword(auth, email, password);

    const querySnapshot = await getDocs(collection(db, "users"));
    querySnapshot.forEach(docSnap => {
      const data = docSnap.data();
      console.log(`- ID: ${docSnap.id} | Email: ${data.email} | Name: ${data.displayName} | Role: ${data.role}`);
    });
  } catch (err) {
    console.error("Lỗi:", err.message);
  }
  process.exit(0);
}

run();
