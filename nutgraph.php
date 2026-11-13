<?php
/**
 * Plugin Name:       Nutgraph
 * Plugin URI:        https://github.com/
 * Description:       Whiteboard met plakbriefjes om verhaalstructuren te bouwen: een ruggengraat van boven naar beneden, details ernaast. Alle gegevens blijven in de browser van de gebruiker. Gebruik de shortcode [nutgraph] of het menu Nutgraph.
 * Version:           1.0.1
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Nutgraph
 * License:           GPL-2.0-or-later
 * Text Domain:       nutgraph
 * Update URI:        https://github.com/nutgraph
 */

// @basis: privacy — Deze plugin slaat NOOIT verhaalgegevens op de server op.
// Er is geen database-tabel, geen AJAX-opslag en geen REST-endpoint voor borden.

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Moet altijd gelijk zijn aan "Version:" hierboven. De controle in GitHub bewaakt dit.
define( 'NUTGRAPH_VERSION', '1.0.0' );
define( 'NUTGRAPH_FILE', __FILE__ );
define( 'NUTGRAPH_DIR', plugin_dir_path( __FILE__ ) );
define( 'NUTGRAPH_URL', plugin_dir_url( __FILE__ ) );

require_once NUTGRAPH_DIR . 'includes/class-nutgraph-updater.php';
require_once NUTGRAPH_DIR . 'includes/class-nutgraph-settings.php';

Nutgraph_Updater::init();
Nutgraph_Settings::init();

/**
 * Registreert de scripts en stijlen. Ze worden alleen geladen waar het bord staat.
 */
function nutgraph_register_assets() {
	wp_register_style(
		'nutgraph',
		NUTGRAPH_URL . 'assets/nutgraph.css',
		array(),
		NUTGRAPH_VERSION
	);
	wp_register_script(
		'nutgraph',
		NUTGRAPH_URL . 'assets/nutgraph.js',
		array(),
		NUTGRAPH_VERSION,
		true
	);
}
add_action( 'wp_enqueue_scripts', 'nutgraph_register_assets' );
add_action( 'admin_enqueue_scripts', 'nutgraph_register_assets' );

/**
 * De lege container waarin JavaScript het hele bord opbouwt.
 */
function nutgraph_container() {
	wp_enqueue_style( 'nutgraph' );
	wp_enqueue_script( 'nutgraph' );
	return '<div class="vb-root" data-nutgraph="1"><noscript>Nutgraph werkt alleen met JavaScript.</noscript></div>';
}

// @basis: shortcode — [nutgraph] zet het bord op elke pagina.
add_shortcode( 'nutgraph', 'nutgraph_container' );

// @basis: adminmenu — het bord is ook bereikbaar in wp-admin.
function nutgraph_admin_menu() {
	add_menu_page(
		'Nutgraph',
		'Nutgraph',
		'edit_posts',
		'nutgraph',
		'nutgraph_admin_page',
		'dashicons-sticky',
		26
	);
}
add_action( 'admin_menu', 'nutgraph_admin_menu' );

function nutgraph_admin_page() {
	echo '<div class="wrap vb-admin-wrap">';
	echo nutgraph_container(); // phpcs:ignore WordPress.Security.EscapeOutput -- vaste HTML zonder invoer.
	echo '</div>';
}
