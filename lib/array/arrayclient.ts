export async function callArrayMergePull(url: string): Promise<string> {
  try {
    const response = await fetch("/api/array/merge-pull", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data.result || "";
  } catch (error) {
    console.error("Array request failed:", error);
    return "";
  }
}
