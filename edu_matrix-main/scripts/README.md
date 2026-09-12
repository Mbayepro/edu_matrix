# Scripts Utilitaires

Scripts JavaScript pour la maintenance et l'administration d'EduMatrix.

## 📁 Scripts disponibles

### Scripts de diagnostic
- `get_table_info.js` - Informations sur les tables de la base de données
- `get_schools.js` - Liste des écoles
- `get_profiles.js` - Liste des profils utilisateurs

## 🚀 Utilisation

```bash
# Exécuter un script
node scripts/get_table_info.js
node scripts/get_schools.js
node scripts/get_profiles.js
```

## ⚠️ Notes

- Ces scripts nécessitent les variables d'environnement Supabase configurées
- Toujours tester sur un environnement de développement avant production
- Les scripts sont en lecture seule et ne modifient pas les données
