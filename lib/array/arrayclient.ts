export async function callArrayMergePull(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const result = await response.text(); // same as ReadToEnd()
    return result;
  } catch (error) {
    console.error("Array request failed:", error);
    return "";
  }
}
