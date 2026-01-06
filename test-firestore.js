import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase.js";

window.testWrite = async function () {
  try {
    const ref = await addDoc(collection(db, "test"), {
      message: "Hello Firestore",
      time: new Date().toISOString()
    });
    alert("Saved with ID: " + ref.id);
    console.log("Saved:", ref.id);
  } catch (e) {
    console.error("ERROR:", e);
    alert("Error – check console");
  }
};
