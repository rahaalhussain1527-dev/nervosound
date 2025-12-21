const trackSelect = document.getElementById("trackSelect");
const infoBox = document.getElementById("infoBox");
const warningText = document.getElementById("warningText");
const descriptionText = document.getElementById("descriptionText");

const trackData = {
  relax: {
    warning: "Uyarı: Bu içerik tıbbi tedavi yerine geçmez.",
    description:
      "Relaxation müziği analiz edildiğinde, frekans spektrumunun büyük ölçüde düşük ve orta frekans aralığında yoğunlaştığı gözlemlenmiştir. Bu yapı, sakinlik ve gevşeme hissi oluşturmayı amaçlamaktadır."
  },
  focus: {
    warning: "Uyarı: Etkiler kişiden kişiye değişebilir.",
    description:
      "Focus müziği, analiz sırasında orta frekanslarda belirgin bir yoğunluk göstermektedir. Bu frekans aralığı, dikkat ve zihinsel odaklanmayı desteklemek amacıyla kullanılmıştır."
  },
  meditation: {
    warning: "Uyarı: Bu müzik bilimsel bir tedavi yöntemi değildir.",
    description:
      "Deep Meditation müziğinde, frekansların ağırlıklı olarak alt frekanslarda toplandığı ve zaman zaman üst harmoniklerin ortaya çıktığı görülmektedir. Bu yapı derin meditasyon ve içsel farkındalık hissini destekler."
  }
};

trackSelect.addEventListener("change", () => {
  const selected = trackSelect.value;

  if (!trackData[selected]) {
    infoBox.style.display = "none";
    return;
  }

  warningText.textContent = trackData[selected].warning;
  descriptionText.textContent = trackData[selected].description;
  infoBox.style.display = "block";
});
