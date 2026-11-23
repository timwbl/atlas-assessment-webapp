type ImageTransition = {
  animation: Animation;
  flight: HTMLImageElement | null;
  cancel: () => void;
};

export function animateQuestionImage(
  stage: HTMLDivElement,
  image: HTMLImageElement | null,
  thumbnail: HTMLImageElement | null,
  opening: boolean,
  previous: ImageTransition | null
): ImageTransition | undefined {
  const dialog = stage.closest("dialog");
  const panel = stage.closest<HTMLElement>(".question-image-viewer");
  const shade = dialog?.querySelector<HTMLElement>(".atlas-dialog-shade");
  if (!dialog?.open || !panel || typeof panel.animate !== "function") return;

  const imageBox = image?.getBoundingClientRect();
  const thumbnailBox = thumbnail?.getBoundingClientRect();
  const sharedImage = image?.naturalWidth && thumbnail?.isConnected && image.src === thumbnail.src
    && thumbnailBox && thumbnailBox.width > 0 && thumbnailBox.height > 0
    && thumbnailBox.top >= 0 && thumbnailBox.left >= 0
    && thumbnailBox.bottom <= window.innerHeight && thumbnailBox.right <= window.innerWidth
    && imageBox && imageBox.width > 0 && imageBox.height > 0;
  const flightStart = opening ? thumbnailBox : previous?.flight?.getBoundingClientRect() ?? imageBox;
  const flightEnd = opening ? imageBox : thumbnailBox;
  const panelOpacity = previous ? getComputedStyle(panel).opacity : "1";
  const shadeOpacity = shade && previous ? getComputedStyle(shade).opacity : "1";
  previous?.cancel();

  const options: KeyframeAnimationOptions = {
    duration: opening ? 240 : 160,
    easing: getComputedStyle(panel).getPropertyValue("--atlas-press-ease").trim(),
    fill: "both"
  };
  const animation = panel.animate([
    { opacity: opening ? (sharedImage ? .54 : .65) : panelOpacity },
    { opacity: opening ? 1 : 0 }
  ], options);
  const shadeAnimation = shade?.animate([
    { opacity: opening ? 0 : shadeOpacity },
    { opacity: opening ? 1 : 0 }
  ], options);

  let flight: HTMLImageElement | null = null;
  let flightAnimation: Animation | undefined;
  if (sharedImage && image && flightStart && flightEnd) {
    flight = image.cloneNode() as HTMLImageElement;
    flight.className = "question-viewer-flight";
    flight.alt = "";
    flight.setAttribute("aria-hidden", "true");
    Object.assign(flight.style, {
      left: `${flightEnd.left}px`,
      top: `${flightEnd.top}px`,
      width: `${flightEnd.width}px`,
      height: `${flightEnd.height}px`,
      transform: "none"
    });
    dialog.append(flight);
    stage.setAttribute("data-moving-image", "");
    thumbnail?.setAttribute("data-viewer-source", "");
    flightAnimation = flight.animate([
      {
        transform: `translate3d(${flightStart.left - flightEnd.left}px, ${flightStart.top - flightEnd.top}px, 0)
          scale(${flightStart.width / flightEnd.width}, ${flightStart.height / flightEnd.height})`
      },
      { transform: "none" }
    ], options);
  }

  return {
    animation,
    flight,
    cancel: () => {
      animation.onfinish = null;
      animation.cancel();
      shadeAnimation?.cancel();
      flightAnimation?.cancel();
      flight?.remove();
      stage.removeAttribute("data-moving-image");
      thumbnail?.removeAttribute("data-viewer-source");
    }
  };
}
