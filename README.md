# MagicBlock Labs Documentation

This repository contains the official documentation for **MagicBlock Labs** products, APIs, and developer guides.  
The docs are built using [Mintlify](https://mintlify.com), enabling a clean and interactive developer experience.

### 📖 Contents
- Guides and tutorials for using MagicBlock Labs tools
- API reference
- Navigation and customization examples
- Best practices and integration tips

You can view the live documentation here: **[https://docs.magicblocklabs.com](https://docs.magicblocklabs.com)**

---

### 👩‍💻 Development

Install the [Mintlify CLI](https://www.npmjs.com/package/mintlify) to preview the documentation changes locally. To install, use the following command

```
npm i -g mintlify
```

Run the following command at the root of your documentation (where mint.json is)

```
mintlify dev
```

### 😎 Publishing Changes

Changes will be deployed to production automatically after pushing to the default branch.

You can also preview changes using PRs, which generates a preview link of the docs.

#### Troubleshooting

- Mintlify dev isn't running - Run `mintlify install` it'll re-install dependencies.
- Page loads as a 404 - Make sure you are running in a folder with `mint.json`
