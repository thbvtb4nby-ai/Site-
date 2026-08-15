import SwiftUI
import SwiftData

struct CategoriesView: View {
    @Query private var categories: [Category]

    var body: some View {
        List {
            if categories.isEmpty {
                ContentUnavailableView("Aucune catégorie", systemImage: "tag")
            } else {
                ForEach(categories) { c in
                    HStack {
                        Image(systemName: c.iconName).foregroundStyle(Color(hex: c.colorHex))
                        Text(c.name)
                    }
                }
            }
        }
        .navigationTitle("Catégories")
    }
}
