export async function OptimizeImgs(imgs: File[]): Promise<File[]> {
  const optimizedFiles: File[] = [];

  for (const file of imgs) {
    const image = await loadImage(file);

    const width = image.naturalWidth;
    const height = image.naturalHeight;

    if (!width || !height) {
      throw new Error(`Invalid image: ${file.name}`);
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas is not supported");
    }

    const initialScale = Math.min(1, 2000 / width, 2000 / height);

    let bestBlob: Blob | null = null;

    try {
      for (const scale of [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1]) {
        const outputWidth = Math.max(
          1,
          Math.round(width * initialScale * scale),
        );

        const outputHeight = Math.max(
          1,
          Math.round(height * initialScale * scale),
        );

        canvas.width = outputWidth;
        canvas.height = outputHeight;

        context.clearRect(0, 0, outputWidth, outputHeight);
        context.drawImage(image, 0, 0, outputWidth, outputHeight);

        for (const quality of [
          0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25, 0.15,
        ]) {
          const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (result) => {
                if (!result || result.type !== "image/webp") {
                  reject(new Error("WebP conversion failed"));
                  return;
                }

                resolve(result);
              },
              "image/webp",
              quality,
            );
          });

          if (!bestBlob || blob.size < bestBlob.size) {
            bestBlob = blob;
          }

          if (blob.size <= 500 * 1024) {
            break;
          }
        }

        if (bestBlob && bestBlob.size <= 500 * 1024) {
          break;
        }
      }

      if (!bestBlob) {
        throw new Error(`Image optimization failed: ${file.name}`);
      }

      optimizedFiles.push(
        new File([bestBlob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, {
          type: "image/webp",
          lastModified: Date.now(),
        }),
      );
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  return optimizedFiles;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Invalid image: ${file.name}`));
    };

    image.src = url;
  });
}
