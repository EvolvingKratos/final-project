document.querySelector(".intro-btn").addEventListener("click",()=>{
    document.querySelector(".img-1").classList.add("brightup");
    document.querySelector(".intro-btn").classList.add("fadeout");
    document.querySelectorAll(".x").forEach(el => {
        el.classList.add("fadeout");
    });
    document.querySelector(".intro-info1").classList.add("fadein");
    document.querySelectorAll(".y").forEach(el=>{
        el.classList.add("fadein");
    })
});
document.querySelectorAll(".scroll-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
        const currentContainer=btn.closest(".story-container");
        const nextContainer=currentContainer.nextElementSibling;
        nextContainer.scrollIntoView({behavior:"smooth",inline:"start"});
    })
});

document.querySelectorAll(".scroll-back").forEach(btn=>{
    btn.addEventListener("click",()=>{
        const currentContainer1=btn.closest(".story-container");
        const prevContainer=currentContainer1.previousElementSibling;
        prevContainer.scrollIntoView({behavior:"smooth",inline:"start"});
    })
});


