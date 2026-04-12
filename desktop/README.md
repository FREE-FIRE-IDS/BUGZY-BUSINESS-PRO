# Bugzy Business Pro - Desktop App (Electron)

This is an Electron wrapper for the Bugzy Business Pro PWA with built-in auto-update support via GitHub Releases.

## 🛠 Prerequisites

1.  **Node.js** installed on your machine.
2.  A **GitHub Repository** to host your releases.
3.  A **GitHub Personal Access Token (PAT)** with `repo` scope (required for publishing).

## 🚀 Getting Started

1.  Open your terminal in the `desktop` folder.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run the app locally:
    ```bash
    npm start
    ```

## 📦 Building the EXE

1.  Open `package.json`.
2.  Update the `publish` section with your GitHub details:
    ```json
    "publish": [
      {
        "provider": "github",
        "owner": "your-github-username",
        "repo": "your-repo-name"
      }
    ]
    ```
3.  Set your GitHub Token as an environment variable (Windows PowerShell):
    ```powershell
    $env:GH_TOKEN="your_personal_access_token"
    ```
4.  Build and Publish to GitHub:
    ```bash
    npm run publish
    ```
    This will create a draft release on GitHub with the `.exe` and `latest.yml` files.

## 🔄 How Auto-Update Works

1.  When the app starts, it checks the GitHub repository for a newer version (based on the `version` in `package.json`).
2.  If a new version is found, it downloads it in the background.
3.  Once downloaded, the app will automatically restart and install the update after 5 seconds.

## 🎨 Customization

-   **Icon**: Replace `icon.png` in this folder with your own 256x256 or 512x512 PNG icon.
-   **URL**: Change the `PWA_URL` constant in `main.js` if your deployment URL changes.
