<?php
/**
 * Haalt nieuwe versies op uit de GitHub-releases van de ingestelde repository.
 *
 * Werkt via de standaard WordPress-route voor plugins met een eigen "Update URI".
 * De plugin vraagt alleen informatie op bij GitHub; er gaat niets van de site naartoe.
 *
 * @basis: updater
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Nutgraph_Updater {

	const CACHE_KEY  = 'nutgraph_github_release';
	const ASSET_NAME = 'nutgraph.zip';
	const SLUG       = 'nutgraph';

	public static function init() {
		add_filter( 'update_plugins_github.com', array( __CLASS__, 'check_update' ), 10, 4 );
		add_filter( 'plugins_api', array( __CLASS__, 'plugin_info' ), 20, 3 );
		add_filter( 'upgrader_source_selection', array( __CLASS__, 'fix_folder_name' ), 10, 4 );
		add_action( 'upgrader_process_complete', array( __CLASS__, 'clear_cache' ), 10, 0 );
	}

	public static function basename() {
		return plugin_basename( NUTGRAPH_FILE );
	}

	/** Repository in de vorm "gebruikersnaam/nutgraph", of een lege tekst. */
	public static function repo() {
		$repo = trim( (string) get_option( 'nutgraph_github_repo', '' ) );
		$repo = preg_replace( '#^https?://github\.com/#i', '', $repo );
		$repo = trim( preg_replace( '#\.git$#', '', $repo ), '/' );
		return preg_match( '#^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$#', $repo ) ? $repo : '';
	}

	public static function clear_cache() {
		delete_site_transient( self::CACHE_KEY );
	}

	/**
	 * Laatste release van GitHub, zes uur in de cache.
	 *
	 * @return array|null ['version','package','url','notes','published']
	 */
	public static function latest_release( $force = false ) {
		$repo = self::repo();
		if ( '' === $repo ) {
			return null;
		}

		if ( ! $force ) {
			$cached = get_site_transient( self::CACHE_KEY );
			if ( is_array( $cached ) && isset( $cached['repo'] ) && $cached['repo'] === $repo ) {
				return empty( $cached['release'] ) ? null : $cached['release'];
			}
		}

		$response = wp_remote_get(
			'https://api.github.com/repos/' . $repo . '/releases/latest',
			array(
				'timeout' => 10,
				'headers' => array(
					'Accept'     => 'application/vnd.github+json',
					'User-Agent' => 'Nutgraph-WordPress-Plugin',
				),
			)
		);

		$release = null;
		if ( ! is_wp_error( $response ) && 200 === wp_remote_retrieve_response_code( $response ) ) {
			$data = json_decode( wp_remote_retrieve_body( $response ), true );
			if ( is_array( $data ) && ! empty( $data['tag_name'] ) ) {
				$package = '';
				if ( ! empty( $data['assets'] ) && is_array( $data['assets'] ) ) {
					foreach ( $data['assets'] as $asset ) {
						if ( isset( $asset['name'] ) && self::ASSET_NAME === $asset['name'] ) {
							$package = $asset['browser_download_url'];
							break;
						}
					}
				}
				if ( '' === $package && ! empty( $data['zipball_url'] ) ) {
					$package = $data['zipball_url'];
				}
				$release = array(
					'version'   => ltrim( $data['tag_name'], 'vV' ),
					'package'   => $package,
					'url'       => isset( $data['html_url'] ) ? $data['html_url'] : 'https://github.com/' . $repo,
					'notes'     => isset( $data['body'] ) ? (string) $data['body'] : '',
					'published' => isset( $data['published_at'] ) ? $data['published_at'] : '',
				);
			}
		}

		// Bij een fout korter cachen, zodat we GitHub niet blijven bestoken.
		set_site_transient(
			self::CACHE_KEY,
			array( 'repo' => $repo, 'release' => $release ),
			$release ? 6 * HOUR_IN_SECONDS : HOUR_IN_SECONDS
		);

		return $release;
	}

	/** Filter van WordPress: is er een update voor deze plugin? */
	public static function check_update( $update, $plugin_data, $plugin_file, $locales ) {
		if ( self::basename() !== $plugin_file ) {
			return $update;
		}
		$release = self::latest_release();
		if ( ! $release || empty( $release['package'] ) ) {
			return $update;
		}
		return array(
			'slug'         => self::SLUG,
			'version'      => $release['version'],
			'url'          => $release['url'],
			'package'      => $release['package'],
			'tested'       => get_bloginfo( 'version' ),
			'requires_php' => '7.4',
		);
	}

	/** Vult het venster "Details bekijken" in het pluginoverzicht. */
	public static function plugin_info( $result, $action, $args ) {
		if ( 'plugin_information' !== $action || empty( $args->slug ) || self::SLUG !== $args->slug ) {
			return $result;
		}
		$release = self::latest_release();
		if ( ! $release ) {
			return $result;
		}
		return (object) array(
			'name'          => 'Nutgraph',
			'slug'          => self::SLUG,
			'version'       => $release['version'],
			'homepage'      => $release['url'],
			'download_link' => $release['package'],
			'last_updated'  => $release['published'],
			'sections'      => array(
				'description' => 'Whiteboard met plakbriefjes voor verhaalstructuren. Gegevens blijven in de browser.',
				'changelog'   => wpautop( esc_html( $release['notes'] ) ),
			),
		);
	}

	/**
	 * GitHub-zips heten soms "gebruiker-nutgraph-abc123". WordPress moet de map
	 * "nutgraph" houden, anders ziet het de update als een andere plugin.
	 */
	public static function fix_folder_name( $source, $remote_source, $upgrader, $hook_extra = array() ) {
		global $wp_filesystem;
		if ( empty( $hook_extra['plugin'] ) || self::basename() !== $hook_extra['plugin'] ) {
			return $source;
		}
		$wanted = trailingslashit( $remote_source ) . self::SLUG . '/';
		if ( trailingslashit( $source ) === $wanted ) {
			return $source;
		}
		if ( $wp_filesystem && $wp_filesystem->move( $source, $wanted, true ) ) {
			return $wanted;
		}
		return $source;
	}
}
