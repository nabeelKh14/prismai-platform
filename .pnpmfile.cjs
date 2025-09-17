module.exports = {
  hooks: {
    readPackage(pkg) {
      // Approve the packages that were flagged in the build warning
      const approvedPackages = [
        '@scarf/scarf',
        '@tree-sitter-grammars/tree-sitter-yaml',
        'core-js-pure',
        'protobufjs',
        'sharp',
        'supabase',
        'tree-sitter',
        'tree-sitter-json'
      ];

      if (approvedPackages.includes(pkg.name)) {
        pkg.approved = true;
      }

      return pkg;
    }
  }
};