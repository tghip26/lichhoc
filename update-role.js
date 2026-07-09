const { initializeApp } = require("firebase/app");
const { getFirestore, doc, updateDoc, getDoc } = require("firebase/firestore");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");

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
  console.log("Đang đọc và cập nhật tài khoản 5uTuBCe64CbG1fuyznzRUi0l9392...");
  try {
    const userDocRef = doc(db, "users", "5uTuBCe64CbG1fuyznzRUi0l9392");
    
    // Đọc thử xem có được không
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      console.log("Đọc trước khi cập nhật thành công:", docSnap.data());
    } else {
      console.log("Tài liệu không tồn tại.");
    }

    // Tiến hành cập nhật
    await updateDoc(userDocRef, {
      role: "admin"
    });
    console.log("Cập nhật thành công!");
    
    // Đọc lại để xác nhận
    const docSnap2 = await getDoc(userDocRef);
    console.log("Đọc sau khi cập nhật:", docSnap2.data());

  } catch (err) {
    console.error("LỖI CHI TIẾT:");
    console.error("Message:", err.message);
    console.error("Code:", err.code);
    console.error("Stack:", err.stack);
  }
  process.exit(0);
}

run();
